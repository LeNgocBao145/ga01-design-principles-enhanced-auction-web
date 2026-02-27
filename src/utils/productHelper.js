import fs from "fs";
import path from "path";
import * as productModel from "../models/product.model.js"; // Sửa lại đường dẫn này cho đúng

export async function createNewProduct(productBody, sellerId) {
  // 1. Chuẩn bị Data
  const productData = {
    seller_id: sellerId,
    category_id: productBody.category_id,
    name: productBody.name,
    starting_price: productBody.start_price.replace(/,/g, ""),
    step_price: productBody.step_price.replace(/,/g, ""),
    buy_now_price:
      productBody.buy_now_price !== ""
        ? productBody.buy_now_price.replace(/,/g, "")
        : null,
    created_at: new Date(productBody.created_at), // Đồng nhất parse Date
    end_at: new Date(productBody.end_date),
    auto_extend: productBody.auto_extend === "1",
    thumbnail: null,
    description: productBody.description,
    highest_bidder_id: null,
    current_price: productBody.start_price.replace(/,/g, ""),
    is_sold: null,
    closed_at: null,
    allow_unrated_bidder: productBody.allow_new_bidders === "1",
  };

  // 2. Thêm vào DB để lấy ID
  const returnedID = await productModel.addProduct(productData);
  const newId = returnedID[0].id;
  const dirPath = path.join("public", "images", "products").replace(/\\/g, "/");

  // 3. Xử lý Thumbnail
  const mainPath = path
    .join(dirPath, `p${newId}_thumb.jpg`)
    .replace(/\\/g, "/");
  const oldMainPath = path
    .join("public", "uploads", path.basename(productBody.thumbnail))
    .replace(/\\/g, "/");
  const savedMainPath =
    "/" +
    path.join("images", "products", `p${newId}_thumb.jpg`).replace(/\\/g, "/");

  fs.renameSync(oldMainPath, mainPath);
  await productModel.updateProductThumbnail(newId, savedMainPath);

  // 4. Xử lý Sub-images
  const imgs = JSON.parse(productBody.imgs_list);
  let newImgPaths = [];

  imgs.forEach((imgPath, index) => {
    const oldPath = path
      .join("public", "uploads", path.basename(imgPath))
      .replace(/\\/g, "/");
    const newPath = path
      .join(dirPath, `p${newId}_${index + 1}.jpg`)
      .replace(/\\/g, "/");
    const savedPath =
      "/" +
      path
        .join("images", "products", `p${newId}_${index + 1}.jpg`)
        .replace(/\\/g, "/");

    fs.renameSync(oldPath, newPath);
    newImgPaths.push({ product_id: newId, img_link: savedPath });
  });

  if (newImgPaths.length > 0) {
    await productModel.addProductImages(newImgPaths);
  }
}
