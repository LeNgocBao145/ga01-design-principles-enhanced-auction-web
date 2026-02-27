class CaptchaService {
  async verifyCaptcha(token) {
    if (!token) return false;

    const secretKey = process.env.RECAPTCHA_SECRET;
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

    try {
      const response = await fetch(verifyUrl, { method: "POST" });
      const data = await response.json();
      return data.success;
    } catch (err) {
      console.error("Recaptcha error:", err);
      return false;
    }
  }
}

export default new CaptchaService();
