import {
  Uppy,
  Dashboard,
  XHRUpload,
} from "https://releases.transloadit.com/uppy/v5.2.0/uppy.min.mjs";

const productData = window.PRODUCT_DATA || {
  thumbnail: "",
  subImgs: [],
  description: "",
};
let thumbnail = productData.thumbnail;
let subImgs = [...productData.subImgs];

let quill;

// 1. CẤU HÌNH UPPY UPLOAD ẢNH

const uppyThumbnail = new Uppy({
  restrictions: {
    maxNumberOfFiles: 1,
    minNumberOfFiles: 1,
    allowedFileTypes: ["image/jpeg", "image/png", "image/webp"],
  },
});
uppyThumbnail.use(Dashboard, {
  target: "#uppy-thumbnail",
  inline: true,
  height: 300,
  proudlyDisplayPoweredByUppy: false,
});
uppyThumbnail.use(XHRUpload, {
  endpoint: "/admin/products/upload-thumbnail",
  fieldName: "thumbnail",
  formData: true,
});

uppyThumbnail.on("file-added", () => {
  const errEl = document.getElementById("thumbnailError");
  if (errEl) errEl.style.display = "none";
});

uppyThumbnail.on("upload-success", (file, response) => {
  if (response.body.file) {
    thumbnail = response.body.file.filename;
    document.getElementById("txt_thumbnail").value = thumbnail;
  }
});

// Uppy cho Ảnh phụ
const uppySubImages = new Uppy({
  restrictions: {
    maxNumberOfFiles: 10,
    minNumberOfFiles: 3,
    allowedFileTypes: ["image/jpeg", "image/png", "image/webp"],
  },
});
uppySubImages.use(Dashboard, {
  target: "#uppy-subimages",
  inline: true,
  height: 300,
  proudlyDisplayPoweredByUppy: false,
});
uppySubImages.use(XHRUpload, {
  endpoint: "/admin/products/upload-subimages",
  fieldName: "images",
  formData: true,
});

uppySubImages.on("file-added", () => {
  const errEl = document.getElementById("subImagesError");
  if (errEl) errEl.style.display = "none";
});

uppySubImages.on("upload-success", (file, response) => {
  if (response.body.files) {
    response.body.files.forEach((f) => {
      subImgs.push(f.filename);
    });
    document.getElementById("txt_imgs_list").value = JSON.stringify(subImgs);
  }
});

// ==========================================
// 2. KHỞI TẠO CÁC PLUGIN & SỰ KIỆN KHI LOAD TRANG
// ==========================================
document.addEventListener("DOMContentLoaded", function () {
  // Khởi tạo Cleave.js
  if (document.getElementById("startPrice"))
    new Cleave("#startPrice", {
      numeral: true,
      numeralThousandsGroupStyle: "thousand",
    });
  if (document.getElementById("stepPrice"))
    new Cleave("#stepPrice", {
      numeral: true,
      numeralThousandsGroupStyle: "thousand",
    });
  if (document.getElementById("buyNowPrice"))
    new Cleave("#buyNowPrice", {
      numeral: true,
      numeralThousandsGroupStyle: "thousand",
    });

  // Khởi tạo Quill
  quill = new Quill("#editor-container", {
    theme: "snow",
    placeholder: "Enter detailed product description...",
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ color: [] }, { background: [] }],
        ["link", "image"],
        ["clean"],
      ],
    },
  });

  // Load Data cũ vào Quill (Trang Edit)
  if (productData.description) {
    quill.clipboard.dangerouslyPasteHTML(productData.description);
  }

  // Gán Created_at tự động (Trang Add)
  const createdAtInput = document.getElementById("createdAt");
  if (createdAtInput && !createdAtInput.value) {
    const now = new Date();
    const localDateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    createdAtInput.value = localDateTime;
  }

  // Hàm phụ trợ xóa lỗi khi nhập liệu
  const clearError = (id, errorId) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", function () {
        this.classList.remove("is-invalid");
        const errEl = document.getElementById(errorId);
        if (errEl) {
          errEl.classList.remove("d-block");
          errEl.style.display = "none";
        }
      });
    }
  };

  clearError("productName", "productNameError");
  clearError("category", "categoryError");
  clearError("startPrice", "startPriceError");
  clearError("stepPrice", "stepPriceError");
  clearError("buyNowPrice", "buyNowPriceError");
  clearError("seller", "sellerError");

  const endDateEl = document.getElementById("endDate");
  if (endDateEl) {
    endDateEl.addEventListener("change", function () {
      this.classList.remove("is-invalid");
      document.getElementById("endDateError").style.display = "none";
      if (this.value) {
        document.getElementById("endDateFormatted").value =
          this.value.replace("T", " ") + ":00";
      }
    });
  }

  // ==========================================
  // 3. XỬ LÝ SỰ KIỆN SUBMIT FORM
  // ==========================================
  const formElement =
    document.getElementById("addProductForm") ||
    document.getElementById("editProductForm");

  if (formElement) {
    formElement.addEventListener("submit", function (e) {
      e.preventDefault();

      const productName = document.getElementById("productName").value.trim();
      const category = document.getElementById("category").value;
      const startPrice = document.getElementById("startPrice").value;
      const stepPrice = document.getElementById("stepPrice").value;
      const buyNowPrice = document.getElementById("buyNowPrice").value;
      const endDateDisplay = document.getElementById("endDate").value;

      // Hàm hiển thị lỗi và TỰ ĐỘNG DỪNG (RETURN)
      const showError = (inputId, errorId, message) => {
        const inputElement = document.getElementById(inputId);
        const errorElement = document.getElementById(errorId);
        if (inputElement) inputElement.classList.add("is-invalid");
        if (errorElement) {
          errorElement.classList.add("d-block");
          errorElement.style.display = "block";
        }
        if (inputElement) {
          inputElement.scrollIntoView({ behavior: "smooth", block: "center" });
          inputElement.focus();
        }
        Swal.fire({
          icon: "error",
          title: "Validation Error",
          text: message,
          confirmButtonColor: "#72AEC8",
        });
      };

      if (!productName)
        return showError(
          "productName",
          "productNameError",
          "Please enter a product name.",
        );
      if (!category)
        return showError(
          "category",
          "categoryError",
          "Please select a category.",
        );

      const parsePrice = (val) => parseInt(val.replace(/,/g, ""));
      if (
        !startPrice ||
        isNaN(parsePrice(startPrice)) ||
        parsePrice(startPrice) < 1000
      ) {
        return showError(
          "startPrice",
          "startPriceError",
          "Please enter a valid starting price (minimum 1,000 VND).",
        );
      }
      if (
        !stepPrice ||
        isNaN(parsePrice(stepPrice)) ||
        parsePrice(stepPrice) < 1000
      ) {
        return showError(
          "stepPrice",
          "stepPriceError",
          "Please enter a valid bid step (minimum 1,000 VND).",
        );
      }
      if (
        buyNowPrice &&
        (isNaN(parsePrice(buyNowPrice)) ||
          parsePrice(buyNowPrice) <= parsePrice(startPrice))
      ) {
        return showError(
          "buyNowPrice",
          "buyNowPriceError",
          "Buy now price must be greater than starting price.",
        );
      }

      if (!endDateDisplay) {
        return showError(
          "endDate",
          "endDateError",
          "Please select a valid end date and time.",
        );
      }
      if (new Date(endDateDisplay) <= new Date()) {
        return showError(
          "endDate",
          "endDateError",
          "End date and time must be in the future.",
        );
      }
      document.getElementById("endDateFormatted").value =
        endDateDisplay.replace("T", " ") + ":00";

      // Validate Hình ảnh
      if (!thumbnail) {
        const el = document.getElementById("uppy-thumbnail");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        document.getElementById("thumbnailError").style.display = "block";
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Please upload a main thumbnail image.",
        });
        return;
      }

      if (subImgs.length < 3) {
        const el = document.getElementById("uppy-subimages");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        document.getElementById("subImagesError").style.display = "block";
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Please upload at least 3 additional images.",
        });
        return;
      }

      const seller = document.getElementById("seller").value;
      if (!seller)
        return showError(
          "seller",
          "sellerError",
          "Please select a seller for this product.",
        );

      // Xử lý Checkbox
      const autoExtendCheckbox = document.getElementById("autoExtend");
      const allowNewBiddersCheckbox =
        document.getElementById("allowNewBidders");
      if (autoExtendCheckbox?.checked)
        document.querySelector(
          'input[name="auto_extend"][type="hidden"]',
        ).disabled = true;
      if (allowNewBiddersCheckbox?.checked)
        document.querySelector(
          'input[name="allow_new_bidders"][type="hidden"]',
        ).disabled = true;

      // Cập nhật Quill
      const descriptionInput = document.getElementById("descriptionInput");
      if (descriptionInput && quill) {
        descriptionInput.value = quill.root.innerHTML.trim();
      }

      // Submit form thực sự (CÁCH NÀY ĐẢM BẢO HOẠT ĐỘNG 100%)
      HTMLFormElement.prototype.submit.call(e.target);
    });
  }
});
