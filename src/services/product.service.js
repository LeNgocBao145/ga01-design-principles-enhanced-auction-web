import * as productModel from "../models/product.model.js";
class ProductService {
  async getProductWithStatus(productId, userId) {
    const product = await productModel.findByProductId2(productId, userId);
    if (!product) return null;

    const now = new Date();
    const endDate = new Date(product.end_at);
    let status = "ACTIVE";

    if (endDate <= now && !product.closed_at && product.is_sold === null) {
      await productModel.updateProduct(productId, { closed_at: endDate });
      product.closed_at = endDate;
    }

    if (product.is_sold === true) status = "SOLD";
    else if (product.is_sold === false) status = "CANCELLED";
    else if ((endDate <= now || product.closed_at) && product.highest_bidder_id)
      status = "PENDING";
    else if (endDate <= now && !product.highest_bidder_id) status = "EXPIRED";

    return { product, status };
  }

  canUserViewProduct(product, status, userId) {
    if (status === "ACTIVE") return true;
    if (!userId) return false;

    const isSeller = product.seller_id === userId;
    const isHighestBidder = product.highest_bidder_id === userId;

    return isSeller || isHighestBidder;
  }

  async getProductFullDetail(productId, userId, models) {
    const {
      productModel,
      reviewModel,
      biddingHistoryModel,
      productCommentModel,
      rejectedBidderModel,
      productDescUpdateModel,
    } = models;

    const product = await productModel.findByProductId2(productId, userId);
    if (!product) return null;

    const [descriptionUpdates, biddingHistory, comments, totalComments] =
      await Promise.all([
        productDescUpdateModel.findByProductId(productId),
        biddingHistoryModel.getBiddingHistory(productId),
        productCommentModel.getCommentsByProductId(productId),
        productCommentModel.countCommentsByProductId(productId),
      ]);

    const sellerRating = await reviewModel.calculateRatingPoint(
      product.seller_id,
    );

    return {
      product,
      descriptionUpdates,
      biddingHistory,
      comments,
      totalComments,
      sellerRating,
    };
  }

  async getProductFullDetail(productId, userId, models) {
    const {
      productModel,
      reviewModel,
      biddingHistoryModel,
      productCommentModel,
      rejectedBidderModel,
      productDescUpdateModel,
    } = models;

    const product = await productModel.findByProductId2(productId, userId);
    if (!product) return null;

    const [descriptionUpdates, biddingHistory, comments, totalComments] =
      await Promise.all([
        productDescUpdateModel.findByProductId(productId),
        biddingHistoryModel.getBiddingHistory(productId),
        productCommentModel.getCommentsByProductId(productId),
        productCommentModel.countCommentsByProductId(productId),
      ]);

    const sellerRating = await reviewModel.calculateRatingPoint(
      product.seller_id,
    );

    return {
      product,
      descriptionUpdates,
      biddingHistory,
      comments,
      totalComments,
      sellerRating,
    };
  }
}

export default new ProductService();
