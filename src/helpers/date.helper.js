export const format_date = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  const second = String(d.getSeconds()).padStart(2, "0");

  return `${hour}:${minute}:${second} ${day}/${month}/${year}`;
};
export const format_only_date = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${day}/${month}/${year}`;
};
export const format_only_time = (time) => {
  if (!time) return "";
  const d = new Date(time);
  if (isNaN(d.getTime())) return "";

  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  const second = String(d.getSeconds()).padStart(2, "0");

  return `${hour}:${minute}:${second}`;
};
export const format_date_input = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
export const time_remaining = (date) => {
  const now = new Date();
  const end = new Date(date);
  const diff = end - now;
  if (diff <= 0) return "00:00:00";
  const hours = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, "0");
  const minutes = String(
    Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
  ).padStart(2, "0");
  const seconds = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(
    2,
    "0",
  );
  return `${hours}:${minutes}:${seconds}`;
};
export const format_time_remaining = (date) => {
  const now = new Date();
  const end = new Date(date);
  console.log(end);
  const diff = end - now;

  if (diff <= 0) return "Auction Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  // > 3 ngày: hiển thị ngày kết thúc
  if (days > 3) {
    if (isNaN(end.getTime())) return "";
    const year = end.getFullYear();
    const month = String(end.getMonth() + 1).padStart(2, "0");
    const day = String(end.getDate()).padStart(2, "0");

    const hour = String(end.getHours()).padStart(2, "0");
    const minute = String(end.getMinutes()).padStart(2, "0");
    const second = String(end.getSeconds()).padStart(2, "0");
    return `${hour}:${minute}:${second} ${day}/${month}/${year}`;
  }

  // <= 3 ngày: hiển thị ... days left
  if (days >= 1) {
    return `${days} days left`;
  }

  // < 1 ngày: hiển thị ... hours left
  if (hours >= 1) {
    return `${hours} hours left`;
  }

  // < 1 giờ: hiển thị ... minutes left
  if (minutes >= 1) {
    return `${minutes} minutes left`;
  }

  // < 1 phút: hiển thị ... seconds left
  return `${seconds} seconds left`;
};
export const should_show_relative_time = (date) => {
  const now = new Date();
  const end = new Date(date);
  const diff = end - now;

  if (diff <= 0) return true; // Auction Ended counts as relative

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days <= 3; // True nếu <= 3 ngày (hiển thị relative time)
};
