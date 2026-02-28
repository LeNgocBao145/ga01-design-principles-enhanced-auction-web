import express from "express";
import * as productModel from "../models/product.model.js";
import * as reviewModel from "../models/review.model.js";
import * as userModel from "../models/user.model.js";
import * as watchListModel from "../models/watchlist.model.js";
import * as biddingHistoryModel from "../models/biddingHistory.model.js";
import * as productCommentModel from "../models/productComment.model.js";
import * as categoryModel from "../models/category.model.js";
import * as productDescUpdateModel from "../models/productDescriptionUpdate.model.js";
import * as systemSettingModel from "../models/systemSetting.model.js";
import * as rejectedBidderModel from "../models/rejectedBidder.model.js";
import * as orderModel from "../models/order.model.js";
import * as invoiceModel from "../models/invoice.model.js";
import * as orderChatModel from "../models/orderChat.model.js";
import * as untilHelper from "../helpers/util.helper.js";
import { isAuthenticated } from "../middlewares/auth.mdw.js";
import db from "../utils/db.js";
import multer from "multer";
import path from "path";
import productService from "../services/product.service.js";
import commentService from "../services/comment.service.js";
import bidService from "../services/bid.service.js";
import mailService from "../services/mail.service.js";
import authService from "../services/auth.service.js";

const router = express.Router();

const prepareProductList = async (products) => {
  const now = new Date();
  if (!products) return [];

  // Load settings from database every time to get latest value
  const settings = await systemSettingModel.getSettings();
  const N_MINUTES = settings.new_product_limit_minutes;

  return products.map((product) => {
    const created = new Date(product.created_at);
    const isNew = now - created < N_MINUTES * 60 * 1000;

    return {
      ...product,
      is_new: isNew,
    };
  });
};

router.get("/category", async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const sort = req.query.sort || "";
  const categoryId = req.query.catid;
  const page = parseInt(req.query.page) || 1;
  const limit = 3;
  const offset = (page - 1) * limit;

  // Check if category is level 1 (parent_id is null)
  const category = await categoryModel.findByCategoryId(categoryId);

  let categoryIds = [categoryId];

  // If it's a level 1 category, include all child categories
  if (category && category.parent_id === null) {
    const childCategories =
      await categoryModel.findChildCategoryIds(categoryId);
    const childIds = childCategories.map((cat) => cat.id);
    categoryIds = [categoryId, ...childIds];
  }

  const list = await productModel.findByCategoryIds(
    categoryIds,
    limit,
    offset,
    sort,
    userId,
  );
  const products = await prepareProductList(list);
  const total = await productModel.countByCategoryIds(categoryIds);
  const { from, to, nPages } = untilHelper.getBaseInformationPagination(
    total.count,
    page,
    limit,
  );
  const totalCount = parseInt(total.count) || 0;
  res.render("vwProduct/list", {
    products: products,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages: nPages,
    categoryId: categoryId,
    categoryName: category ? category.name : null,
    sort: sort,
  });
});

router.get("/search", async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const q = req.query.q || "";
  const logic = req.query.logic || "and"; // 'and' or 'or'
  const sort = req.query.sort || "";

  // If keyword is empty, return empty results
  if (q.length === 0) {
    return res.render("vwProduct/list", {
      q: q,
      logic: logic,
      sort: sort,
      products: [],
      totalCount: 0,
      from: 0,
      to: 0,
      currentPage: 1,
      totalPages: 0,
    });
  }

  const limit = 3;
  const page = parseInt(req.query.page) || 1;
  const offset = (page - 1) * limit;

  // Pass keywords directly without modification
  // plainto_tsquery will handle tokenization automatically
  const keywords = q.trim();

  // Search in both product name and category
  const list = await productModel.searchPageByKeywords(
    keywords,
    limit,
    offset,
    userId,
    logic,
    sort,
  );
  const products = await prepareProductList(list);
  const total = await productModel.countByKeywords(keywords, logic);
  const { from, to, nPages } = untilHelper.getBaseInformationPagination(
    total.count,
    page,
    limit,
  );

  const totalCount = parseInt(total.count) || 0;
  res.render("vwProduct/list", {
    products: products,
    totalCount,
    from,
    to,
    currentPage: page,
    totalPages: nPages,
    q: q,
    logic: logic,
    sort: sort,
  });
});

router.get("/detail", async (req, res) => {
  const userId = req.session.authUser ? req.session.authUser.id : null;
  const productId = req.query.id;
  const productData = await productService.getProductWithStatus(
    productId,
    userId,
  );

  // Kiểm tra nếu không tìm thấy sản phẩm
  if (!productData) {
    return res.status(404).render("404", { message: "Product not found" });
  }
  const { product, status: productStatus } = productData;

  console.log("Product details:", product);

  if (!productService.canUserViewProduct(product, productStatus, userId)) {
    return res.status(403).render("403", {
      message: "You do not have permission to view this product",
    });
  }

  // Pagination for comments
  const commentPage = parseInt(req.query.commentPage) || 1;
  const commentData = await commentService.getPaginatedCommentsWithReplies(
    productId,
    commentPage,
  );

  // Load description updates, bidding history, and comments in parallel
  const [related_products, descriptionUpdates, biddingHistory] =
    await Promise.all([
      productModel.findRelatedProducts(productId),
      productDescUpdateModel.findByProductId(productId),
      biddingHistoryModel.getBiddingHistory(productId),
    ]);

  // Load rejected bidders (only for seller)
  let rejectedBidders = [];
  if (userId && product.seller_id === userId) {
    rejectedBidders = await rejectedBidderModel.getRejectedBidders(productId);
  }

  const [sellerRatingObject, sellerReviews] = await Promise.all([
    reviewModel.calculateRatingPoint(product.seller_id),
    reviewModel.getReviewsByUserId(product.seller_id),
  ]);
  // Get bidder rating (if exists)
  let bidderRatingObject = { rating_point: null };
  let bidderReviews = [];
  if (product.highest_bidder_id) {
    bidderRatingObject = await reviewModel.calculateRatingPoint(
      product.highest_bidder_id,
    );
    bidderReviews = await reviewModel.getReviewsByUserId(
      product.highest_bidder_id,
    );
  }

  const success_message = req.session.success_message;
  const error_message = req.session.error_message;
  delete req.session.success_message;
  delete req.session.error_message;

  // Check if should show payment button (for seller or highest bidder when status is PENDING)
  // Hiển thị nút thanh toán
  const showPaymentButton =
    userId &&
    productStatus === "PENDING" &&
    (product.seller_id === userId || product.highest_bidder_id === userId);

  res.render("vwProduct/details", {
    product,
    productStatus,
    authUser: req.session.authUser,
    descriptionUpdates,
    biddingHistory,
    rejectedBidders,
    comments: commentData.comments,
    success_message,
    error_message,
    related_products,
    seller_rating_point: sellerRatingObject?.rating_point,
    seller_has_reviews: sellerReviews.length > 0,
    bidder_rating_point: bidderRatingObject?.rating_point,
    bidder_has_reviews: bidderReviews.length > 0,
    commentPage,
    totalPages: commentData.totalPages,
    totalComments: commentData.totalComments,
    showPaymentButton,
  });
});

// ROUTE: BIDDING HISTORY PAGE (Requires Authentication)
router.get("/bidding-history", isAuthenticated, async (req, res) => {
  const productId = req.query.id;

  if (!productId) {
    return res.redirect("/");
  }

  try {
    // Get product information
    const product = await productModel.findByProductId2(productId, null);

    if (!product) {
      return res.status(404).render("404", { message: "Product not found" });
    }

    // Load bidding history
    const biddingHistory =
      await biddingHistoryModel.getBiddingHistory(productId);

    res.render("vwProduct/biddingHistory", {
      product,
      biddingHistory,
    });
  } catch (error) {
    console.error("Error loading bidding history:", error);
    res
      .status(500)
      .render("500", { message: "Unable to load bidding history" });
  }
});

// ROUTE 1: THÊM VÀO WATCHLIST (POST)
router.post("/watchlist", isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;

  const isInWatchlist = await watchListModel.isInWatchlist(userId, productId);
  if (!isInWatchlist) {
    await watchListModel.addToWatchlist(userId, productId);
  }

  // SỬA LẠI: Lấy địa chỉ trang trước đó từ header
  // Nếu không tìm thấy (trường hợp hiếm), quay về trang chủ '/'
  const retUrl = req.headers.referer || "/";
  res.redirect(retUrl);
});

// ROUTE 2: XÓA KHỎI WATCHLIST (DELETE)
router.delete("/watchlist", isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.body.productId;

  await watchListModel.removeFromWatchlist(userId, productId);

  // SỬA LẠI: Tương tự như trên
  const retUrl = req.headers.referer || "/";
  res.redirect(retUrl);
});

// ROUTE 3: ĐẶT GIÁ (POST) - Server-side rendering with automatic bidding
router.post("/bid", isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = parseInt(req.body.productId);
  const bidAmount = parseFloat(req.body.bidAmount.replace(/,/g, "")); // Remove commas from input

  try {
    const result = await bidService.placeBid(userId, productId, bidAmount);
    await mailService.sendBidMail(
      result,
      productId,
      req.protocol,
      req.get("host"),
    );
    let baseMessage = "";
    if (result.productSold) {
      baseMessage =
        result.newHighestBidderId === userId
          ? `Congratulations! You won the product with Buy Now price: ${result.newCurrentPrice.toLocaleString()} VND.`
          : `Product has been sold to another bidder at Buy Now price.`;
    } else if (result.newHighestBidderId === userId) {
      baseMessage = `Bid placed successfully! Current price: ${result.newCurrentPrice.toLocaleString()} VND.`;
    } else {
      baseMessage = `Bid placed! Another bidder is currently winning at ${result.newCurrentPrice.toLocaleString()} VND.`;
    }

    if (result.autoExtended) {
      baseMessage += ` | Auction extended to ${new Date(result.newEndTime).toLocaleString("vi-VN")}`;
    }

    req.session.success_message = baseMessage;
    res.redirect(`/products/detail?id=${productId}`);
  } catch (error) {
    console.error("Bid error:", error);
    req.session.error_message =
      error.message || "An error occurred while placing bid. Please try again.";
    res.redirect(`/products/detail?id=${productId}`);
  }
});

// ROUTE: POST COMMENT
router.post("/comment", isAuthenticated, async (req, res) => {
  const { productId, content, parentId } = req.body;
  const userId = req.session.authUser.id;

  try {
    await commentService.createComment(productId, userId, content, parentId);

    await mailService.sendCommentMail(
      productId,
      userId,
      content,
      parentId,
      req.protocol,
      req.get("host"),
    );

    req.session.success_message = "Comment posted successfully!";
    res.redirect(`/products/detail?id=${productId}`);
  } catch (error) {
    console.error("Post comment error:", error);
    req.session.error_message = "Failed to post comment. Please try again.";
    res.redirect(`/products/detail?id=${productId}`);
  }
});

// ROUTE 4: GET BIDDING HISTORY
router.get("/bid-history/:productId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const history = await biddingHistoryModel.getBiddingHistory(productId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error("Get bid history error:", error);
    res
      .status(500)
      .json({ success: false, message: "Unable to load bidding history" });
  }
  const result = await productModel.findByProductId(productId);
  const relatedProducts = await productModel.findRelatedProducts(productId);
  const product = {
    thumbnail: result[0].thumbnail,
    sub_images: result.reduce((acc, curr) => {
      if (curr.img_link) {
        acc.push(curr.img_link);
      }
      return acc;
    }, []),
    id: result[0].id,
    name: result[0].name,
    starting_price: result[0].starting_price,
    current_price: result[0].current_price,
    seller_id: result[0].seller_id,
    seller_fullname: result[0].seller_name,
    seller_rating:
      result[0].seller_rating_plus /
      (result[0].seller_rating_plus + result[0].seller_rating_minus),
    seller_member_since: new Date(result[0].seller_created_at).getFullYear(),
    buy_now_price: result[0].buy_now_price,
    seller_id: result[0].seller_id,
    hightest_bidder_id: result[0].highest_bidder_id,
    bidder_name: result[0].bidder_name,
    category_name: result[0].category_name,
    bid_count: result[0].bid_count,
    created_at: result[0].created_at,
    end_at: result[0].end_at,
    description: result[0].description,
    related_products: relatedProducts,
  };
  res.render("vwProduct/details", { product });
});

// // ROUTE: COMPLETE ORDER PAGE (For PENDING products

router.get("/complete-order", isAuthenticated, async (req, res) => {
  const userId = req.session.authUser.id;
  const productId = req.query.id;

  if (!productId) {
    return res.redirect("/");
  }

  const product = await productModel.findByProductId2(productId, userId);

  if (!product) {
    return res.status(404).render("404", { message: "Product not found" });
  }

  // Determine product status
  const now = new Date();
  const endDate = new Date(product.end_at);
  let productStatus = "ACTIVE";

  if (product.is_sold === true) {
    productStatus = "SOLD";
  } else if (product.is_sold === false) {
    productStatus = "CANCELLED";
  } else if (
    (endDate <= now || product.closed_at) &&
    product.highest_bidder_id
  ) {
    productStatus = "PENDING";
  } else if (endDate <= now && !product.highest_bidder_id) {
    productStatus = "EXPIRED";
  }

  // Only PENDING products can access this page
  if (productStatus !== "PENDING") {
    return res.redirect(`/products/detail?id=${productId}`);
  }

  // Only seller or highest bidder can access
  const isSeller = product.seller_id === userId;
  const isHighestBidder = product.highest_bidder_id === userId;

  if (!isSeller && !isHighestBidder) {
    return res
      .status(403)
      .render("403", {
        message: "You do not have permission to access this page",
      });
  }

  // Fetch or create order
  let order = await orderModel.findByProductId(productId);

  if (!order) {
    // Auto-create order if not exists (trigger should handle this, but fallback)
    const orderData = {
      product_id: productId,
      buyer_id: product.highest_bidder_id,
      seller_id: product.seller_id,
      final_price: product.current_price || product.highest_bid || 0,
    };
    await orderModel.createOrder(orderData);
    order = await orderModel.findByProductId(productId);
  }

  // Fetch invoices
  let paymentInvoice = await invoiceModel.getPaymentInvoice(order.id);
  let shippingInvoice = await invoiceModel.getShippingInvoice(order.id);

  // Parse PostgreSQL arrays to JavaScript arrays
  if (paymentInvoice && paymentInvoice.payment_proof_urls) {
    console.log(
      "Original payment_proof_urls:",
      paymentInvoice.payment_proof_urls,
    );
    console.log("Type:", typeof paymentInvoice.payment_proof_urls);

    if (typeof paymentInvoice.payment_proof_urls === "string") {
      // PostgreSQL returns array as string like: {url1,url2,url3}
      paymentInvoice.payment_proof_urls = paymentInvoice.payment_proof_urls
        .replace(/^\{/, "")
        .replace(/\}$/, "")
        .split(",")
        .filter((url) => url);
      console.log(
        "Parsed payment_proof_urls:",
        paymentInvoice.payment_proof_urls,
      );
    }
  }

  if (shippingInvoice && shippingInvoice.shipping_proof_urls) {
    if (typeof shippingInvoice.shipping_proof_urls === "string") {
      shippingInvoice.shipping_proof_urls = shippingInvoice.shipping_proof_urls
        .replace(/^\{/, "")
        .replace(/\}$/, "")
        .split(",")
        .filter((url) => url);
    }
  }

  // Fetch chat messages
  const messages = await orderChatModel.getMessagesByOrderId(order.id);

  res.render("vwProduct/complete-order", {
    product,
    order,
    paymentInvoice,
    shippingInvoice,
    messages,
    isSeller,
    isHighestBidder,
    currentUserId: userId,
  });
});

// ===================================================================================
// IMAGE UPLOAD FOR PAYMENT/SHIPPING PROOFS
// ===================================================================================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file ảnh (jpg, png, gif)!"));
    }
  },
});

router.post(
  "/order/upload-images",
  isAuthenticated,
  upload.array("images", 5),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const urls = req.files.map((file) => `uploads/${file.filename}`);
      res.json({ success: true, urls });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  },
);

// ===================================================================================
// ORDER PAYMENT & SHIPPING ROUTES
// ===================================================================================

// Submit payment (Buyer)
router.post(
  "/order/:orderId/submit-payment",
  isAuthenticated,
  async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const userId = req.session.authUser.id;
      const {
        payment_method,
        payment_proof_urls,
        note,
        shipping_address,
        shipping_phone,
      } = req.body;

      // Verify user is buyer
      const order = await orderModel.findById(orderId);
      if (!order || order.buyer_id !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Create payment invoice
      await invoiceModel.createPaymentInvoice({
        order_id: orderId,
        issuer_id: userId,
        payment_method,
        payment_proof_urls,
        note,
      });

      // Update order
      await orderModel.updateShippingInfo(orderId, {
        shipping_address,
        shipping_phone,
      });

      await orderModel.updateStatus(orderId, "payment_submitted", userId);

      res.json({ success: true, message: "Payment submitted successfully" });
    } catch (error) {
      console.error("Submit payment error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to submit payment" });
    }
  },
);

// Confirm payment (Seller)
router.post(
  "/order/:orderId/confirm-payment",
  isAuthenticated,
  async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const userId = req.session.authUser.id;

      // Verify user is seller
      const order = await orderModel.findById(orderId);
      if (!order || order.seller_id !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Verify payment invoice
      const paymentInvoice = await invoiceModel.getPaymentInvoice(orderId);
      if (!paymentInvoice) {
        return res.status(400).json({ error: "No payment invoice found" });
      }

      await invoiceModel.verifyInvoice(paymentInvoice.id);
      await orderModel.updateStatus(orderId, "payment_confirmed", userId);

      res.json({ success: true, message: "Payment confirmed successfully" });
    } catch (error) {
      console.error("Confirm payment error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to confirm payment" });
    }
  },
);

// Submit shipping (Seller)
router.post(
  "/order/:orderId/submit-shipping",
  isAuthenticated,
  async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const userId = req.session.authUser.id;
      const { tracking_number, shipping_provider, shipping_proof_urls, note } =
        req.body;

      // Verify user is seller
      const order = await orderModel.findById(orderId);
      if (!order || order.seller_id !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Create shipping invoice
      await invoiceModel.createShippingInvoice({
        order_id: orderId,
        issuer_id: userId,
        tracking_number,
        shipping_provider,
        shipping_proof_urls,
        note,
      });

      await orderModel.updateStatus(orderId, "shipped", userId);

      res.json({
        success: true,
        message: "Shipping info submitted successfully",
      });
    } catch (error) {
      console.error("Submit shipping error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to submit shipping" });
    }
  },
);

// Confirm delivery (Buyer)
router.post(
  "/order/:orderId/confirm-delivery",
  isAuthenticated,
  async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const userId = req.session.authUser.id;

      // Verify user is buyer
      const order = await orderModel.findById(orderId);
      if (!order || order.buyer_id !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await orderModel.updateStatus(orderId, "delivered", userId);

      res.json({ success: true, message: "Delivery confirmed successfully" });
    } catch (error) {
      console.error("Confirm delivery error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to confirm delivery" });
    }
  },
);

// Submit rating (Both)
router.post(
  "/order/:orderId/submit-rating",
  isAuthenticated,
  async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const userId = req.session.authUser.id;
      const { rating, comment } = req.body;

      // Verify user is buyer or seller
      const order = await orderModel.findById(orderId);
      if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Determine who is being rated
      const isBuyer = order.buyer_id === userId;
      const reviewerId = userId;
      const revieweeId = isBuyer ? order.seller_id : order.buyer_id;

      // Convert rating to number (positive = 1, negative = -1)
      const ratingValue = rating === "positive" ? 1 : -1;

      // Check if already rated
      const existingReview = await reviewModel.findByReviewerAndProduct(
        reviewerId,
        order.product_id,
      );

      if (existingReview) {
        // Update existing review
        await reviewModel.updateByReviewerAndProduct(
          reviewerId,
          order.product_id,
          {
            rating: ratingValue,
            comment: comment || null,
          },
        );
      } else {
        // Create new review (using existing create function)
        await reviewModel.create({
          reviewer_id: reviewerId,
          reviewed_user_id: revieweeId,
          product_id: order.product_id,
          rating: ratingValue,
          comment: comment || null,
        });
      }

      // Check if both parties have completed (rated or skipped)
      const buyerReview = await reviewModel.getProductReview(
        order.buyer_id,
        order.seller_id,
        order.product_id,
      );
      const sellerReview = await reviewModel.getProductReview(
        order.seller_id,
        order.buyer_id,
        order.product_id,
      );

      if (buyerReview && sellerReview) {
        // Both completed, mark order as completed
        await orderModel.updateStatus(orderId, "completed", userId);

        // Update product as sold and set closed_at to payment completion time
        await db("products").where("id", order.product_id).update({
          is_sold: true,
          closed_at: new Date(),
        });
      }

      res.json({ success: true, message: "Rating submitted successfully" });
    } catch (error) {
      console.error("Submit rating error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to submit rating" });
    }
  },
);

// Complete transaction without rating (skip)
router.post(
  "/order/:orderId/complete-transaction",
  isAuthenticated,
  async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const userId = req.session.authUser.id;

      // Verify user is buyer or seller
      const order = await orderModel.findById(orderId);
      if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Determine who is being rated
      const isBuyer = order.buyer_id === userId;
      const reviewerId = userId;
      const revieweeId = isBuyer ? order.seller_id : order.buyer_id;

      // Create review record with rating=0 to indicate "skipped"
      const existingReview = await reviewModel.findByReviewerAndProduct(
        reviewerId,
        order.product_id,
      );

      if (!existingReview) {
        await reviewModel.create({
          reviewer_id: reviewerId,
          reviewed_user_id: revieweeId,
          product_id: order.product_id,
          rating: 0, // 0 means skipped
          comment: null,
        });
      }

      // Check if both parties have completed (rated or skipped)
      const buyerReview = await reviewModel.getProductReview(
        order.buyer_id,
        order.seller_id,
        order.product_id,
      );
      const sellerReview = await reviewModel.getProductReview(
        order.seller_id,
        order.buyer_id,
        order.product_id,
      );

      if (buyerReview && sellerReview) {
        // Both completed, mark order as completed
        await orderModel.updateStatus(orderId, "completed", userId);

        // Update product as sold and set closed_at to payment completion time
        await db("products").where("id", order.product_id).update({
          is_sold: true,
          closed_at: new Date(),
        });
      }

      res.json({ success: true, message: "Transaction completed" });
    } catch (error) {
      console.error("Complete transaction error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to complete transaction" });
    }
  },
);

// Send message (Chat)
router.post(
  "/order/:orderId/send-message",
  isAuthenticated,
  async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const userId = req.session.authUser.id;
      const { message } = req.body;

      // Verify user is buyer or seller
      const order = await orderModel.findById(orderId);
      if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await orderChatModel.sendMessage({
        order_id: orderId,
        sender_id: userId,
        message,
      });

      res.json({ success: true, message: "Message sent successfully" });
    } catch (error) {
      console.error("Send message error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to send message" });
    }
  },
);

// Get chat messages for an order
router.get("/order/:orderId/messages", isAuthenticated, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.authUser.id;

    // Verify user is buyer or seller
    const order = await orderModel.findById(orderId);
    if (!order || (order.buyer_id !== userId && order.seller_id !== userId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Get messages
    const messages = await orderChatModel.getMessagesByOrderId(orderId);

    // Generate HTML for messages
    let messagesHtml = "";
    messages.forEach((msg) => {
      const isSent = msg.sender_id === userId;
      const messageClass = isSent ? "text-end" : "";
      const bubbleClass = isSent ? "sent" : "received";

      // Format date: HH:mm:ss DD/MM/YYYY
      const msgDate = new Date(msg.created_at);
      const year = msgDate.getFullYear();
      const month = String(msgDate.getMonth() + 1).padStart(2, "0");
      const day = String(msgDate.getDate()).padStart(2, "0");
      const hour = String(msgDate.getHours()).padStart(2, "0");
      const minute = String(msgDate.getMinutes()).padStart(2, "0");
      const second = String(msgDate.getSeconds()).padStart(2, "0");
      const formattedDate = `${hour}:${minute}:${second} ${day}/${month}/${year}`;

      messagesHtml += `
        <div class="chat-message ${messageClass}">
          <div class="chat-bubble ${bubbleClass}">
            <div>${msg.message}</div>
            <div style="font-size: 0.7rem; margin-top: 3px; opacity: 0.8;">${formattedDate}</div>
          </div>
        </div>
      `;
    });

    res.json({ success: true, messagesHtml });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: error.message || "Failed to get messages" });
  }
});

// ROUTE: REJECT BIDDER (POST) - Seller rejects a bidder from a product
router.post("/reject-bidder", isAuthenticated, async (req, res) => {
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;

  try {
    const { rejectedBidderInfo, productInfo, sellerInfo } =
      await authService.rejectBidder(productId, bidderId, sellerId);
    const hostProtocol = `${req.protocol}://${req.get("host")}`;
    mailService.sendBidRejectionEmail(
      rejectedBidderInfo,
      productInfo,
      sellerInfo,
      hostProtocol,
    );

    return res.json({ success: true, message: "Bidder rejected successfully" });
  } catch (error) {
    console.error("Error rejecting bidder:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to reject bidder",
    });
  }
});

// ROUTE: UNREJECT BIDDER (POST) - Seller removes a bidder from rejected list
router.post("/unreject-bidder", isAuthenticated, async (req, res) => {
  const { productId, bidderId } = req.body;
  const sellerId = req.session.authUser.id;

  try {
    // Verify product ownership
    const product = await productModel.findByProductId2(productId, sellerId);

    if (!product) {
      throw new Error("Product not found");
    }

    if (product.seller_id !== sellerId) {
      throw new Error("Only the seller can unreject bidders");
    }

    // Check product status - only allow unrejection for ACTIVE products
    const now = new Date();
    const endDate = new Date(product.end_at);

    if (product.is_sold !== null || endDate <= now || product.closed_at) {
      throw new Error("Can only unreject bidders for active auctions");
    }

    // Remove from rejected_bidders table
    await rejectedBidderModel.unrejectBidder(productId, bidderId);

    res.json({
      success: true,
      message: "Bidder can now bid on this product again",
    });
  } catch (error) {
    console.error("Error unrejecting bidder:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to unreject bidder",
    });
  }
});

// ROUTE: BUY NOW (POST) - Bidder directly purchases product at buy now price
router.post("/buy-now", isAuthenticated, async (req, res) => {
  const { productId } = req.body;
  const userId = req.session.authUser.id;

  try {
    await db.transaction(async (trx) => {
      // 1. Get product information
      const product = await trx("products")
        .leftJoin("users as seller", "products.seller_id", "seller.id")
        .where("products.id", productId)
        .select("products.*", "seller.fullname as seller_name")
        .first();

      if (!product) {
        throw new Error("Product not found");
      }

      // 2. Check if user is the seller
      if (product.seller_id === userId) {
        throw new Error("Seller cannot buy their own product");
      }

      // 3. Check if product is still ACTIVE
      const now = new Date();
      const endDate = new Date(product.end_at);

      if (product.is_sold !== null) {
        throw new Error("Product is no longer available");
      }

      if (endDate <= now || product.closed_at) {
        throw new Error("Auction has already ended");
      }

      // 4. Check if buy_now_price exists
      if (!product.buy_now_price) {
        throw new Error("Buy Now option is not available for this product");
      }

      const buyNowPrice = parseFloat(product.buy_now_price);

      // 5. Check if bidder is rejected
      const isRejected = await trx("rejected_bidders")
        .where({ product_id: productId, bidder_id: userId })
        .first();

      if (isRejected) {
        throw new Error("You have been rejected from bidding on this product");
      }

      // 6. Check if bidder is unrated and product doesn't allow unrated bidders
      if (!product.allow_unrated_bidder) {
        const bidder = await trx("users").where("id", userId).first();
        const ratingData = await reviewModel.calculateRatingPoint(userId);
        const ratingPoint = ratingData ? ratingData.rating_point : 0;

        if (ratingPoint === 0) {
          throw new Error(
            "This product does not allow bidders without ratings",
          );
        }
      }

      // 7. Close the auction immediately at buy now price
      // Mark as buy_now_purchase to distinguish from regular bidding wins
      await trx("products").where("id", productId).update({
        current_price: buyNowPrice,
        highest_bidder_id: userId,
        highest_max_price: buyNowPrice,
        end_at: now,
        closed_at: now,
        is_buy_now_purchase: true,
      });

      // 8. Create bidding history record
      // Mark this record as a Buy Now purchase (not a regular bid)
      await trx("bidding_history").insert({
        product_id: productId,
        bidder_id: userId,
        current_price: buyNowPrice,
        is_buy_now: true,
      });

      // Note: We do NOT insert into auto_bidding table for Buy Now purchases
      // Reason: Buy Now is a direct purchase, not an auto bid. If we insert here,
      // it could create inconsistency where another bidder has higher max_price
      // in auto_bidding table but this user is the highest_bidder in products table.
      // The bidding_history record above is sufficient to track this purchase.
    });

    res.json({
      success: true,
      message:
        "Congratulations! You have successfully purchased the product at Buy Now price. Please proceed to payment.",
      redirectUrl: `/products/complete-order?id=${productId}`,
    });
  } catch (error) {
    console.error("Buy Now error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to purchase product",
    });
  }
});

// ROUTE: Seller Ratings Page
router.get("/seller/:sellerId/ratings", async (req, res) => {
  try {
    const sellerId = parseInt(req.params.sellerId);

    if (!sellerId) {
      return res.redirect("/");
    }

    // Get seller info
    const seller = await userModel.findById(sellerId);
    if (!seller) {
      return res.redirect("/");
    }

    // Get rating point
    const ratingData = await reviewModel.calculateRatingPoint(sellerId);
    const rating_point = ratingData ? ratingData.rating_point : 0;

    // Get all reviews
    const reviews = await reviewModel.getReviewsByUserId(sellerId);

    // Calculate statistics
    const totalReviews = reviews.length;
    const positiveReviews = reviews.filter((r) => r.rating === 1).length;
    const negativeReviews = reviews.filter((r) => r.rating === -1).length;

    res.render("vwProduct/seller-ratings", {
      sellerName: seller.fullname,
      rating_point,
      totalReviews,
      positiveReviews,
      negativeReviews,
      reviews,
    });
  } catch (error) {
    console.error("Error loading seller ratings page:", error);
    res.redirect("/");
  }
});

// ROUTE: Bidder Ratings Page
router.get("/bidder/:bidderId/ratings", async (req, res) => {
  try {
    const bidderId = parseInt(req.params.bidderId);

    if (!bidderId) {
      return res.redirect("/");
    }

    // Get bidder info
    const bidder = await userModel.findById(bidderId);
    if (!bidder) {
      return res.redirect("/");
    }

    // Get rating point
    const ratingData = await reviewModel.calculateRatingPoint(bidderId);
    const rating_point = ratingData ? ratingData.rating_point : 0;

    // Get all reviews
    const reviews = await reviewModel.getReviewsByUserId(bidderId);

    // Calculate statistics
    const totalReviews = reviews.length;
    const positiveReviews = reviews.filter((r) => r.rating === 1).length;
    const negativeReviews = reviews.filter((r) => r.rating === -1).length;

    // Mask bidder name
    const maskedName = bidder.fullname
      ? bidder.fullname
          .split("")
          .map((char, index) => (index % 2 === 0 ? char : "*"))
          .join("")
      : "";

    res.render("vwProduct/bidder-ratings", {
      bidderName: maskedName,
      rating_point,
      totalReviews,
      positiveReviews,
      negativeReviews,
      reviews,
    });
  } catch (error) {
    console.error("Error loading bidder ratings page:", error);
    res.redirect("/");
  }
});

export default router;
