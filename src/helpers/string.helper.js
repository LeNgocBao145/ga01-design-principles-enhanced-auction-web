export const format_number = (price) => {
  return new Intl.NumberFormat("en-US").format(price);
};
export const mask_name = (fullname) => {
  if (!fullname) return null;
  const name = fullname.trim();
  if (name.length === 0) return null;
  if (name.length === 1) return "*";
  if (name.length === 2) return name[0] + "*";

  // Mã hóa xen kẽ: giữ ký tự ở vị trí chẵn (0,2,4...), thay bằng * ở vị trí lẻ (1,3,5...)
  // Khoảng trắng cũng được xử lý như ký tự bình thường
  let masked = "";
  for (let i = 0; i < name.length; i++) {
    if (i % 2 === 0) {
      masked += name[i]; // Giữ nguyên ký tự ở vị trí chẵn (kể cả khoảng trắng)
    } else {
      masked += "*"; // Thay bằng * ở vị trí lẻ
    }
  }
  return masked;
};
export const truncate = (str, len) => {
  if (!str) return "";
  if (str.length <= len) return str;
  return str.substring(0, len) + "...";
};
