import * as userModel from "../models/user.model.js";
class OtpService {
  generateOtpWithExpiry(minutes) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    return { otp, expiresAt };
  }

  async createOtp(purpose, id) {
    const otpData = this.generateOtpWithExpiry(15);

    await userModel.createOtp({
      user_id: id,
      otp_code: otpData.otp,
      purpose: purpose,
      expires_at: otpData.expiresAt,
    });

    return otpData;
  }
}

export default new OtpService();
