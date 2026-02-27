import otpService from "./otp.service.js";
import mailService from "./mail.service.js";
import * as userModel from "../models/user.model.js";
import bcrypt from "bcryptjs";

class AuthService {
  async handleForgotPassword(email) {
    const user = await userModel.findByEmail(email);

    if (!user) {
      return {
        success: false,
        message: "Email not found.",
      };
    }

    const otpData = await otpService.createOtp("reset_password", user.id);

    await mailService.sendResetPasswordMail(
      user.email,
      user.fullname,
      otpData.otp,
    );

    return { success: true };
  }

  async handleResendForgotPasswordOtp(email) {
    const user = await userModel.findByEmail(email);

    if (!user) {
      return {
        success: false,
        message: "Email not found.",
      };
    }

    const otpData = await otpService.createOtp("reset_password", user.id);

    await mailService.sendResendForgotPasswordOtpMail(
      user.email,
      user.fullname,
      otpData.otp,
    );

    return {
      success: true,
      message: "We have sent a new OTP to your email. Please check your inbox.",
    };
  }

  async handleSignup(userData) {
    console.log("gia tri user data: ", userData);
    const { fullname, email, address, password } = userData;

    const isEmailExist = await userModel.findByEmail(email);
    if (isEmailExist) {
      throw new Error("Email is already in use");
    }

    // 2. Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    console.log("pass", hashedPassword);
    // 3. Tạo User
    const newUser = await userModel.add({
      email,
      fullname,
      address,
      password_hash: hashedPassword,
      role: "bidder",
    });
    console.log("Pass sign up");

    // 4. Tạo OTP

    const otpData = await otpService.createOtp("verify_email", newUser.id);

    const verifyUrl = `${process.env.APP_BASE_URL}/account/verify-email?email=${encodeURIComponent(
      email,
    )}`;
    // 5. Gửi Email (Có thể dùng Queue hoặc bất đồng bộ ở đây)
    await mailService.sendSignupMail(email, fullname, otpData.otp, verifyUrl);

    return newUser;
  }

  async rejectBidder(productId, bidderId, sellerId) {
    let rejectedBidderInfo, productInfo, sellerInfo;

    await db.transaction(async (trx) => {
      // 1. Verify Product & Authorization
      const product = await trx("products")
        .where("id", productId)
        .forUpdate()
        .first();
      this.validateRejectionConditions(product, sellerId);

      // 2. Verify Bid exists
      const autoBid = await trx("auto_bidding")
        .where({ product_id: productId, bidder_id: bidderId })
        .first();
      if (!autoBid)
        throw new Error("This bidder has not placed a bid on this product");

      // Save info for notification
      rejectedBidderInfo = await trx("users").where("id", bidderId).first();
      sellerInfo = await trx("users").where("id", sellerId).first();
      productInfo = product;

      // 3. Remove bidder data & add to blacklist
      await trx("rejected_bidders")
        .insert({
          product_id: productId,
          bidder_id: bidderId,
          seller_id: sellerId,
        })
        .onConflict(["product_id", "bidder_id"])
        .ignore();

      await trx("bidding_history")
        .where({ product_id: productId, bidder_id: bidderId })
        .del();
      await trx("auto_bidding")
        .where({ product_id: productId, bidder_id: bidderId })
        .del();

      // 4. Recalculate Prices
      await this.recalculateAuctionStatus(trx, product, bidderId);
    });

    return { rejectedBidderInfo, productInfo, sellerInfo };
  }

  // --- Private Helper Methods (Dễ dàng chia nhỏ logic để test) ---

  validateRejectionConditions(product, sellerId) {
    if (!product) throw new Error("Product not found");
    if (product.seller_id !== sellerId)
      throw new Error("Only the seller can reject bidders");

    const now = new Date();
    const endDate = new Date(product.end_at);
    if (product.is_sold !== null || endDate <= now || product.closed_at) {
      throw new Error("Can only reject bidders for active auctions");
    }
  }

  async recalculateAuctionStatus(trx, product, rejectedBidderId) {
    const allAutoBids = await trx("auto_bidding")
      .where("product_id", product.id)
      .orderBy("max_price", "desc");

    const wasHighestBidder =
      parseInt(product.highest_bidder_id) === parseInt(rejectedBidderId);

    if (allAutoBids.length === 0) {
      // No more bidders
      await trx("products").where("id", product.id).update({
        highest_bidder_id: null,
        current_price: product.starting_price,
        highest_max_price: null,
      });
    } else if (allAutoBids.length === 1) {
      // Only one bidder left
      const winner = allAutoBids[0];
      await trx("products").where("id", product.id).update({
        highest_bidder_id: winner.bidder_id,
        current_price: product.starting_price,
        highest_max_price: winner.max_price,
      });

      if (
        wasHighestBidder ||
        product.current_price !== product.starting_price
      ) {
        await trx("bidding_history").insert({
          product_id: product.id,
          bidder_id: winner.bidder_id,
          current_price: product.starting_price,
        });
      }
    } else if (wasHighestBidder) {
      // Multiple bidders left, and the rejected one was highest
      const [firstBidder, secondBidder] = allAutoBids;
      let newPrice = Math.min(
        secondBidder.max_price + product.step_price,
        firstBidder.max_price,
      );

      await trx("products").where("id", product.id).update({
        highest_bidder_id: firstBidder.bidder_id,
        current_price: newPrice,
        highest_max_price: firstBidder.max_price,
      });

      const lastHistory = await trx("bidding_history")
        .where("product_id", product.id)
        .orderBy("created_at", "desc")
        .first();
      if (!lastHistory || lastHistory.current_price !== newPrice) {
        await trx("bidding_history").insert({
          product_id: product.id,
          bidder_id: firstBidder.bidder_id,
          current_price: newPrice,
        });
      }
    }
  }
}

export default new AuthService();
