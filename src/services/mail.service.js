import { sendMail } from "../utils/mailer.js";
import * as biddingHistoryModel from "../models/biddingHistory.model.js";
import * as userModel from "../models/user.model.js";
import * as productCommentModel from "../models/productComment.model.js";
import * as productModel from "../models/product.model.js";

class MailService {
  async sendResetPasswordAdminMail(to, fullname, defaultPassword) {
    await sendMail({
      to,
      subject: "Your Password Has Been Reset - Online Auction",
      html: `
         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Notification</h2>
          <p>Dear <strong>${fullname}</strong>,</p>
          <p>Your account password has been reset by an administrator.</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Your new temporary password:</strong></p>
              <p style="font-size: 24px; color: #e74c3c; margin: 10px 0; font-weight: bold;">${defaultPassword}</p>
          </div>
          <p style="color: #e74c3c;"><strong>Important:</strong> Please log in and change your password immediately for security purposes.</p>
          <p>If you did not request this password reset, please contact our support team immediately.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #888; font-size: 12px;">This is an automated message from Online Auction. Please do not reply to this email.</p>
        </div>
      `,
    });
  }
  async sendResetPasswordMail(to, fullname, otp) {
    await sendMail({
      to,
      subject: "Password Reset for Your Online Auction Account",
      html: `
        <p>Hi ${fullname},</p>
        <p>Your OTP code for password reset is: <strong>${otp}</strong></p>
        <p>This code will expire in 15 minutes.</p>
      `,
    });
  }
  async sendResendForgotPasswordOtpMail(to, fullname, otp) {
    await sendMail({
      to,
      subject: "New OTP for Password Reset",
      html: `
        <p>Hi ${fullname},</p>
        <p>Your OTP code for password reset is: <strong>${otp}</strong></p>
        <p>This code will expire in 15 minutes.</p>
      `,
    });
  }
  async sendSigninMail(to, fullname, otp) {
    await sendMail({
      to,
      subject: "Verify your Online Auction account",
      html: `
        <p>Hi ${fullname},</p>
        <p>Your OTP code is: <strong>${otp}</strong></p>
        <p>This code will expire in 15 minutes.</p>
      `,
    });
  }

  async sendSignupMail(to, fullname, otp, verifyUrl) {
    await sendMail({
      to,
      subject: "Verify your Online Auction account",
      html: `
        <p>Hi ${fullname},</p>
        <p>Thank you for registering at Online Auction.</p>
        <p>Your OTP code is: <strong>${otp}</strong></p>
        <p>This code will expire in 15 minutes.</p>
        <p>You can enter this code on the verification page, or click the link below:</p>
        <p><a href="${verifyUrl}">Verify your email</a></p>
        <p>If you did not register, please ignore this email.</p>
        `,
    });
  }

  async sendAppendDescription(notifyUsers) {
    const productUrl = `${req.protocol}://${req.get("host")}/products/detail?id=${productId}`;

    // Send emails in background (don't await)
    Promise.all(
      notifyUsers.map((user) => {
        return sendMail({
          to: user.email,
          subject: `[Auction Update] New description added for "${product.name}"`,
          html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #72AEC8 0%, #5a9bb8 100%); padding: 20px; text-align: center;">
                                <h1 style="color: white; margin: 0;">Product Description Updated</h1>
                            </div>
                            <div style="padding: 20px; background: #f9f9f9;">
                                <p>Hello <strong>${user.fullname}</strong>,</p>
                                <p>The seller has added new information to the product description:</p>
                                <div style="background: white; padding: 15px; border-left: 4px solid #72AEC8; margin: 15px 0;">
                                    <h3 style="margin: 0 0 10px 0; color: #333;">${product.name}</h3>
                                    <p style="margin: 0; color: #666;">Current Price: <strong style="color: #72AEC8;">${new Intl.NumberFormat("en-US").format(product.current_price)} VND</strong></p>
                                </div>
                                <div style="background: #fff8e1; padding: 15px; border-radius: 5px; margin: 15px 0;">
                                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #f57c00;"><i>✉</i> New Description Added:</p>
                                    <div style="color: #333;">${description.trim()}</div>
                                </div>
                                <p>View the product to see the full updated description:</p>
                                <a href="${productUrl}" style="display: inline-block; background: #72AEC8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 10px 0;">View Product</a>
                                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                                <p style="color: #999; font-size: 12px;">You received this email because you placed a bid or asked a question on this product.</p>
                            </div>
                        </div>
                    `,
        }).catch((err) =>
          console.error("Failed to send email to", user.email, err),
        );
      }),
    ).catch((err) => console.error("Email notification error:", err));
  }
  async sendResendOtpMail(to, fullname, otp, verifyUrl) {
    await sendMail({
      to,
      subject: "New OTP for email verification",
      html: `
      <p>Hi ${fullname},</p>
      <p>Your new OTP code is: <strong>${otp}</strong></p>
      <p>This code will expire in 15 minutes.</p>
    `,
    });
  }

  async sendBidMail(bidResult, productId, protocol, host) {
    try {
      const productUrl = `${protocol}://${host}/products/detail?id=${productId}`;

      const [seller, currentBidder, previousBidder] = await Promise.all([
        userModel.findById(bidResult.sellerId),
        userModel.findById(bidResult.userId),
        bidResult.previousHighestBidderId &&
        bidResult.previousHighestBidderId !== bidResult.userId
          ? userModel.findById(bidResult.previousHighestBidderId)
          : null,
      ]);

      const emailPromises = [];

      // 1. Mail cho người bán (Seller)
      if (seller?.email) {
        emailPromises.push(
          sendMail({
            to: seller.email,
            subject: `💰 New bid on your product: ${bidResult.productName}`,
            html: this.getSellerTemplate(
              seller,
              currentBidder,
              bidResult,
              productUrl,
            ),
          }),
        );
      }

      // 2. Mail cho người vừa đặt giá (Current Bidder)
      if (currentBidder?.email) {
        const isWinning = bidResult.newHighestBidderId === bidResult.userId;
        emailPromises.push(
          sendMail({
            to: currentBidder.email,
            subject: isWinning
              ? `✅ You're winning: ${bidResult.productName}`
              : `📊 Bid placed: ${bidResult.productName}`,
            html: this.getCurrentBidderTemplate(
              currentBidder,
              bidResult,
              isWinning,
              productUrl,
            ),
          }),
        );
      }

      // 3. Mail cho người bị vượt giá (Previous Bidder)
      if (previousBidder?.email && bidResult.priceChanged) {
        const wasOutbid =
          bidResult.newHighestBidderId !== bidResult.previousHighestBidderId;
        emailPromises.push(
          sendMail({
            to: previousBidder.email,
            subject: wasOutbid
              ? `⚠️ You've been outbid: ${bidResult.productName}`
              : `📊 Price updated: ${bidResult.productName}`,
            html: this.getPreviousBidderTemplate(
              previousBidder,
              bidResult,
              wasOutbid,
              productUrl,
            ),
          }),
        );
      }

      if (emailPromises.length > 0) {
        await Promise.all(emailPromises);
        console.log(
          `${emailPromises.length} bid notification email(s) sent for product #${productId}`,
        );
      }
    } catch (error) {
      console.error("Failed to send bid notification emails:", error);
    }
  }

  // Các hàm private chứa HTML (Bạn dán HTML cũ của bạn vào đây cho gọn)
  getSellerTemplate(seller, bidder, result, productUrl) {
    return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">New Bid Received!</h1>
              </div>
              <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <p>Dear <strong>${seller.fullname}</strong>,</p>
                <p>Great news! Your product has received a new bid:</p>
                <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #72AEC8;">
                  <h3 style="margin: 0 0 15px 0; color: #333;">${result.productName}</h3>
                  <p style="margin: 5px 0;"><strong>Bidder:</strong> ${bidder ? bidder.fullname : "Anonymous"}</p>
                  <p style="margin: 5px 0;"><strong>Current Price:</strong></p>
                  <p style="font-size: 28px; color: #72AEC8; margin: 5px 0; font-weight: bold;">
                    ${new Intl.NumberFormat("en-US").format(result.newCurrentPrice)} VND
                  </p>
                  ${
                    result.previousPrice !== result.newCurrentPrice
                      ? `
                  <p style="margin: 5px 0; color: #666; font-size: 14px;">
                    <i>Previous: ${new Intl.NumberFormat("en-US").format(result.previousPrice)} VND</i>
                  </p>
                  `
                      : ""
                  }
                </div>
                ${
                  result.productSold
                    ? `
                <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p style="margin: 0; color: #155724;"><strong>🎉 Buy Now price reached!</strong> Auction has ended.</p>
                </div>
                `
                    : ""
                }
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${productUrl}" style="display: inline-block; background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    View Product
                  </a>
                </div>
              </div>
              <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">This is an automated message from Online Auction.</p>
            </div>
          `;
  }

  getCurrentBidderTemplate(bidder, result, isWinning, productUrl) {
    return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, ${isWinning ? "#28a745" : "#ffc107"} 0%, ${isWinning ? "#218838" : "#e0a800"} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">${isWinning ? "You're Winning!" : "Bid Placed"}</h1>
              </div>
              <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <p>Dear <strong>${bidder.fullname}</strong>,</p>
                <p>${
                  isWinning
                    ? "Congratulations! Your bid has been placed and you are currently the highest bidder!"
                    : "Your bid has been placed. However, another bidder has a higher maximum bid."
                }</p>
                <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${isWinning ? "#28a745" : "#ffc107"};">
                  <h3 style="margin: 0 0 15px 0; color: #333;">${result.productName}</h3>
                  <p style="margin: 5px 0;"><strong>Your Max Bid:</strong> ${new Intl.NumberFormat("en-US").format(result.bidAmount)} VND</p>
                  <p style="margin: 5px 0;"><strong>Current Price:</strong></p>
                  <p style="font-size: 28px; color: ${isWinning ? "#28a745" : "#ffc107"}; margin: 5px 0; font-weight: bold;">
                    ${new Intl.NumberFormat("en-US").format(result.newCurrentPrice)} VND
                  </p>
                </div>
                ${
                  result.productSold && isWinning
                    ? `
                <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p style="margin: 0; color: #155724;"><strong>🎉 Congratulations! You won this product!</strong></p>
                  <p style="margin: 10px 0 0 0; color: #155724;">Please proceed to complete your payment.</p>
                </div>
                `
                    : ""
                }
                ${
                  !isWinning
                    ? `
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p style="margin: 0; color: #856404;"><strong>💡 Tip:</strong> Consider increasing your maximum bid to improve your chances of winning.</p>
                </div>
                `
                    : ""
                }
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${productUrl}" style="display: inline-block; background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    ${result.productSold && isWinning ? "Complete Payment" : "View Auction"}
                  </a>
                </div>
              </div>
              <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">This is an automated message from Online Auction.</p>
            </div>
          `;
  }

  getPreviousBidderTemplate(bidder, result, wasOutbid, productUrl) {
    return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, ${wasOutbid ? "#dc3545" : "#ffc107"} 0%, ${wasOutbid ? "#c82333" : "#e0a800"} 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">${wasOutbid ? "You've Been Outbid!" : "Price Updated"}</h1>
              </div>
              <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <p>Dear <strong>${bidder.fullname}</strong>,</p>
                ${
                  wasOutbid
                    ? `<p>Unfortunately, another bidder has placed a higher bid on the product you were winning:</p>`
                    : `<p>Good news! You're still the highest bidder, but the current price has been updated due to a new bid:</p>`
                }
                <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid ${wasOutbid ? "#dc3545" : "#ffc107"};">
                  <h3 style="margin: 0 0 15px 0; color: #333;">${result.productName}</h3>
                  ${
                    !wasOutbid
                      ? `
                  <p style="margin: 5px 0; color: #28a745;"><strong>✓ You're still winning!</strong></p>
                  `
                      : ""
                  }
                  <p style="margin: 5px 0;"><strong>New Current Price:</strong></p>
                  <p style="font-size: 28px; color: ${wasOutbid ? "#dc3545" : "#ffc107"}; margin: 5px 0; font-weight: bold;">
                    ${new Intl.NumberFormat("en-US").format(result.newCurrentPrice)} VND
                  </p>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                    <i>Previous price: ${new Intl.NumberFormat("en-US").format(result.previousPrice)} VND</i>
                  </p>
                </div>
                ${
                  wasOutbid
                    ? `
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p style="margin: 0; color: #856404;"><strong>💡 Don't miss out!</strong> Place a new bid to regain the lead.</p>
                </div>
                `
                    : `
                <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
                  <p style="margin: 0; color: #155724;"><strong>💡 Tip:</strong> Your automatic bidding is working! Consider increasing your max bid if you want more protection.</p>
                </div>
                `
                }
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${productUrl}" style="display: inline-block; background: linear-gradient(135deg, ${wasOutbid ? "#28a745" : "#72AEC8"} 0%, ${wasOutbid ? "#218838" : "#5a9ab8"} 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                    ${wasOutbid ? "Place New Bid" : "View Auction"}
                  </a>
                </div>
              </div>
              <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">This is an automated message from Online Auction.</p>
            </div>
          `;
  }

  // Các hàm chứa HTML (Bạn dán HTML của bạn vào đây)
  getSellerReplyTemplate(recipientName, product, seller, content, productUrl) {
    return ` <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #667eea;">New Reply on Your Product</h2>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p><strong>Product:</strong> ${product.name}</p>
        <p><strong>From:</strong> ${commenter.fullname}</p>
        <p><strong>Reply:</strong></p>
        <p style="background-color: white; padding: 15px; border-radius: 5px;">${content}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${productUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          View Product & Reply
        </a>
      </div>
    </div>`;
  }

  getNewCommentTemplate(isReply, product, commenter, content, productUrl) {
    return ` <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #667eea;">New Question About Your Product</h2>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <p><strong>Product:</strong> ${product.name}</p>
        <p><strong>From:</strong> ${commenter.fullname}</p>
        <p><strong>Question:</strong></p>
        <p style="background-color: white; padding: 15px; border-radius: 5px;">${content}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${productUrl}" style="display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          View Product & Answer
        </a>
      </div>
    </div>`;
  }

  async sendCommentMail(
    productId,
    commenterId,
    content,
    parentId,
    protocol,
    host,
  ) {
    try {
      const productUrl = `${protocol}://${host}/products/detail?id=${productId}`;

      // Lấy data cần thiết song song để tối ưu tốc độ
      const [product, commenter] = await Promise.all([
        productModel.findByProductId2(productId, null),
        userModel.findById(commenterId),
      ]);
      const seller = await userModel.findById(product.seller_id);

      const isSellerReplying = commenterId === product.seller_id;

      if (isSellerReplying && parentId) {
        console.log("send mail 1");
        await this.notifyBuyersAboutSellerReply(
          product,
          seller,
          content,
          productUrl,
        );
      } else if (seller?.email && commenterId !== product.seller_id) {
        console.log("send mail 2");
        await this.notifySellerAboutNewComment(
          product,
          commenter,
          seller,
          content,
          parentId,
          productUrl,
        );
      }
    } catch (error) {
      // Bắt lỗi ở đây để không làm sập ứng dụng nếu quá trình gửi mail thất bại
      console.error("Error in CommentNotificationService:", error);
    }
  }

  // --- PRIVATE METHODS ---

  async notifyBuyersAboutSellerReply(product, seller, content, productUrl) {
    const [bidders, commenters] = await Promise.all([
      biddingHistoryModel.getUniqueBidders(product.id),
      productCommentModel.getUniqueCommenters(product.id),
    ]);

    const recipientsMap = new Map();

    const addRecipient = (user) => {
      if (user.id !== product.seller_id && user.email) {
        recipientsMap.set(user.id, {
          email: user.email,
          fullname: user.fullname,
        });
      }
    };

    bidders.forEach(addRecipient);
    commenters.forEach(addRecipient);

    const emailPromises = Array.from(recipientsMap.values()).map((recipient) =>
      sendMail({
        to: recipient.email,
        subject: `Seller answered a question on: ${product.name}`,
        html: this.getSellerReplyTemplate(
          recipient.fullname,
          product,
          seller,
          content,
          productUrl,
        ),
      }).catch((err) =>
        console.error(`Failed to send email to ${recipient.email}:`, err),
      ),
    );

    await Promise.all(emailPromises);
    console.log(
      `Seller reply notification sent to ${recipientsMap.size} recipients`,
    );
  }

  async notifySellerAboutNewComment(
    product,
    commenter,
    seller,
    content,
    parentId,
    productUrl,
  ) {
    const isReply = !!parentId;
    const subject = isReply
      ? `New reply on your product: ${product.name}`
      : `New question about your product: ${product.name}`;

    await sendMail({
      to: seller.email,
      subject: subject,
      html: this.getNewCommentTemplate(
        isReply,
        product,
        commenter,
        content,
        productUrl,
      ),
    });
  }

  async sendBidRejectionEmail(bidder, product, seller, hostProtocol) {
    if (!bidder || !bidder.email || !product) return;

    const subject = `Your bid has been rejected: ${product.name}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Bid Rejected</h1>
        </div>
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Dear <strong>${bidder.fullname}</strong>,</p>
          <p>We regret to inform you that the seller has rejected your bid on the following product:</p>
          <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${product.name}</h3>
            <p style="margin: 5px 0; color: #666;"><strong>Seller:</strong> ${seller ? seller.fullname : "N/A"}</p>
          </div>
          <p style="color: #666;">This means you can no longer place bids on this specific product. Your previous bids on this product have been removed.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${hostProtocol}/" style="display: inline-block; background: linear-gradient(135deg, #72AEC8 0%, #5a9ab8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Browse Other Auctions
            </a>
          </div>
        </div>
      </div>
    `;

    try {
      await sendMail({ to: bidder.email, subject, html: htmlContent });
      console.log(
        `Rejection email sent to ${bidder.email} for product #${product.id}`,
      );
    } catch (error) {
      console.error("Failed to send rejection email:", error);
    }
  }
}

export default new MailService();
