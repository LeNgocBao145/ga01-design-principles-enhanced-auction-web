import db from "../utils/db.js";
import * as reviewModel from "../models/review.model.js";
import * as systemSettingModel from "../models/systemSetting.model.js";
class BidService {
  // --- PRIVATE METHODS CHUYÊN TRÁCH --- //

  async validateBidRequirements(trx, product, userId, bidAmount, currentPrice) {
    if (product.is_sold === true)
      throw new Error("This product has already been sold");
    if (product.seller_id === userId)
      throw new Error("You cannot bid on your own product");

    const isRejected = await trx("rejected_bidders")
      .where({ product_id: product.id, bidder_id: userId })
      .first();
    if (isRejected)
      throw new Error(
        "You have been rejected from bidding on this product by the seller",
      );

    const now = new Date();
    if (now > new Date(product.end_at)) throw new Error("Auction has ended");

    if (bidAmount <= currentPrice)
      throw new Error(`Bid must be higher than current price`);

    const minIncrement = parseFloat(product.step_price);
    if (bidAmount < currentPrice + minIncrement)
      throw new Error(
        `Bid must be at least ${minIncrement.toLocaleString()} VND higher than current price`,
      );

    // Check rating
    const ratingPoint = await reviewModel.calculateRatingPoint(userId);
    const userReviews = await reviewModel.getReviewsByUserId(userId);
    if (userReviews.length === 0 && !product.allow_unrated_bidder) {
      throw new Error("This seller does not allow unrated bidders to bid.");
    }
    if (
      userReviews.length > 0 &&
      (ratingPoint.rating_point <= 0.8 || ratingPoint.rating_point <= 0)
    ) {
      throw new Error("Your rating point is too low. You cannot place bids.");
    }
  }

  async calculateAutoExtend(product) {
    if (!product.auto_extend) return null;

    const settings = await systemSettingModel.getSettings();
    const triggerMinutes = settings?.auto_extend_trigger_minutes;
    const extendMinutes = settings?.auto_extend_duration_minutes;

    const now = new Date();
    const endTime = new Date(product.end_at);
    const minutesRemaining = (endTime - now) / (1000 * 60);

    if (minutesRemaining <= triggerMinutes) {
      return new Date(endTime.getTime() + extendMinutes * 60 * 1000);
    }
    return null;
  }

  calculateAutoBiddingState(product, userId, bidAmount) {
    // Dán toàn bộ khối logic // ========== AUTOMATIC BIDDING LOGIC ========== từ Case 0 đến Case 2c của bạn vào đây
    // Khối này chỉ có if/else tính toán số liệu, KHÔNG đụng DB
    // ...
    // Trả về Object { newCurrentPrice, newHighestBidderId, newHighestMaxPrice, productSold, shouldCreateHistory }
    let newCurrentPrice;
    let newHighestBidderId;
    let newHighestMaxPrice;
    let shouldCreateHistory = true; // Flag to determine if we should create bidding history
    let productSold = false;

    // Special handling for buy_now_price: First-come-first-served
    // If current highest bidder already has max >= buy_now, and a NEW bidder comes in,
    // the existing bidder wins at buy_now price immediately
    const buyNowPrice = product.buy_now_price
      ? parseFloat(product.buy_now_price)
      : null;
    let buyNowTriggered = false;

    const minIncrement = parseFloat(product.step_price);
    if (
      buyNowPrice &&
      product.highest_bidder_id &&
      product.highest_max_price &&
      product.highest_bidder_id !== userId
    ) {
      const currentHighestMaxPrice = parseFloat(product.highest_max_price);

      // If current highest bidder already bid >= buy_now, they win immediately (when new bidder comes)
      if (currentHighestMaxPrice >= buyNowPrice) {
        newCurrentPrice = buyNowPrice;
        newHighestBidderId = product.highest_bidder_id;
        newHighestMaxPrice = currentHighestMaxPrice;
        buyNowTriggered = true;
        // New bidder's auto-bid will be recorded, but they don't win
      }
    }

    // Only run normal auto-bidding if buy_now not triggered by existing bidder
    if (!buyNowTriggered) {
      // Case 0: Người đặt giá chính là người đang giữ giá cao nhất
      if (product.highest_bidder_id === userId) {
        // Chỉ update max_price trong auto_bidding, không thay đổi current_price
        // Không tạo bidding_history mới vì giá không thay đổi
        newCurrentPrice = parseFloat(
          product.current_price || product.starting_price,
        );
        newHighestBidderId = userId;
        newHighestMaxPrice = bidAmount; // Update max price
        shouldCreateHistory = false; // Không tạo history mới
      }
      // Case 1: Chưa có người đấu giá nào (first bid)
      else if (!product.highest_bidder_id || !product.highest_max_price) {
        newCurrentPrice = product.starting_price; // Only 1 bidder, no competition, set to starting price
        newHighestBidderId = userId;
        newHighestMaxPrice = bidAmount;
      }
      // Case 2: Đã có người đấu giá trước đó
      else {
        const currentHighestMaxPrice = parseFloat(product.highest_max_price);
        const currentHighestBidderId = product.highest_bidder_id;

        // Case 2a: bidAmount < giá tối đa của người cũ
        if (bidAmount < currentHighestMaxPrice) {
          // Người cũ thắng, giá hiện tại = bidAmount của người mới
          newCurrentPrice = bidAmount;
          newHighestBidderId = currentHighestBidderId;
          newHighestMaxPrice = currentHighestMaxPrice; // Giữ nguyên max price của người cũ
          productSold = true;
        }
        // Case 2b: bidAmount == giá tối đa của người cũ
        else if (bidAmount === currentHighestMaxPrice) {
          // Người cũ thắng theo nguyên tắc first-come-first-served
          newCurrentPrice = bidAmount;
          newHighestBidderId = currentHighestBidderId;
          newHighestMaxPrice = currentHighestMaxPrice;
        }
        // Case 2c: bidAmount > giá tối đa của người cũ
        else {
          // Người mới thắng, giá hiện tại = giá max của người cũ + step_price
          newCurrentPrice = currentHighestMaxPrice + minIncrement;
          newHighestBidderId = userId;
          newHighestMaxPrice = bidAmount;
        }
      }

      // 7. Check if buy now price is reached after auto-bidding
      if (buyNowPrice && newCurrentPrice >= buyNowPrice) {
        // Nếu đạt giá mua ngay, set giá = buy_now_price
        newCurrentPrice = buyNowPrice;
        buyNowTriggered = true;
      }
    }

    return {
      newCurrentPrice,
      newHighestBidderId,
      newHighestMaxPrice,
      productSold,
      shouldCreateHistory,
    };
  }

  async persistBidTransaction(
    trx,
    productId,
    userId,
    bidAmount,
    bidState,
    extendedEndTime,
  ) {
    const updateData = {
      current_price: bidState.newCurrentPrice,
      highest_bidder_id: bidState.newHighestBidderId,
      highest_max_price: bidState.newHighestMaxPrice,
    };

    if (bidState.productSold) {
      updateData.end_at = new Date();
      updateData.closed_at = new Date();
    } else if (extendedEndTime) {
      updateData.end_at = extendedEndTime;
    }

    await trx("products").where("id", productId).update(updateData);

    if (bidState.shouldCreateHistory) {
      await trx("bidding_history").insert({
        product_id: productId,
        bidder_id: bidState.newHighestBidderId,
        current_price: bidState.newCurrentPrice,
      });
    }

    await trx.raw(
      `
        INSERT INTO auto_bidding (product_id, bidder_id, max_price)
        VALUES (?, ?, ?)
        ON CONFLICT (product_id, bidder_id)
        DO UPDATE SET max_price = EXCLUDED.max_price, created_at = NOW()
      `,
      [productId, userId, bidAmount],
    );
  }

  async placeBid(userId, productId, bidAmount) {
    return await db.transaction(async (trx) => {
      // 1. Lock Row
      const product = await trx("products")
        .where("id", productId)
        .forUpdate()
        .first();
      if (!product) throw new Error("Product not found");

      const previousHighestBidderId = product.highest_bidder_id;
      const previousPrice = parseFloat(
        product.current_price || product.starting_price,
      );

      // 2. Chạy hàm Validate điều kiện đấu giá
      await this.validateBidRequirements(
        trx,
        product,
        userId,
        bidAmount,
        previousPrice,
      );

      // 3. Tính toán Auto Extend
      let extendedEndTime = await this.calculateAutoExtend(product);

      // 4. Tính toán Auto Bidding (Trả về object state mới)
      const bidState = this.calculateAutoBiddingState(
        product,
        userId,
        bidAmount,
        previousPrice,
      );

      // 5. Thực thi Update DB
      await this.persistBidTransaction(
        trx,
        productId,
        userId,
        bidAmount,
        bidState,
        extendedEndTime,
      );

      // 6. Trả về kết quả cho Controller
      return {
        ...bidState,
        userId,
        bidAmount,
        autoExtended: !!extendedEndTime,
        newEndTime: extendedEndTime || product.end_at,
        productName: product.name,
        sellerId: product.seller_id,
        previousHighestBidderId,
        previousPrice,
        priceChanged: previousPrice !== bidState.newCurrentPrice,
      };
    });
  }
}

export default new BidService();
