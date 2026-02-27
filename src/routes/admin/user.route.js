import express from "express";
import bcrypt from "bcryptjs";
import * as upgradeRequestModel from "../../models/upgradeRequest.model.js";
import * as userModel from "../../models/user.model.js";
import { sendMail } from "../../utils/mailer.js";

import { catchAsync } from "../../utils/catchAsync.js";

const router = express.Router();

router.get(
  "/list",
  catchAsync(async (req, res) => {
    const users = await userModel.loadAllUsers();
    const success_message = req.session.success_message;
    const error_message = req.session.error_message;

    delete req.session.success_message;
    delete req.session.error_message;

    res.render("vwAdmin/users/list", {
      users,
      empty: users.length === 0,
      success_message,
      error_message,
    });
  }),
);

router.get(
  "/detail/:id",
  catchAsync(async (req, res) => {
    const user = await userModel.findById(req.params.id);
    res.render("vwAdmin/users/detail", { user });
  }),
);

router.get("/add", (req, res) => res.render("vwAdmin/users/form"));

router.get(
  "/edit/:id",
  catchAsync(async (req, res) => {
    const user = await userModel.findById(req.params.id);
    const error_message = req.session.error_message;
    delete req.session.error_message;
    res.render("vwAdmin/users/form", { user, error_message });
  }),
);

router.post(
  "/add",
  catchAsync(
    async (req, res) => {
      const {
        fullname,
        email,
        address,
        date_of_birth,
        role,
        email_verified,
        password,
      } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);

      await userModel.add({
        fullname,
        email,
        address,
        date_of_birth: date_of_birth || null,
        role,
        email_verified: email_verified === "true",
        password_hash: hashedPassword,
        created_at: new Date(),
        updated_at: new Date(),
      });

      req.session.success_message = "User added successfully!";
      res.redirect("/admin/users/list");
    },
    "/admin/users/add",
    "Failed to add user. Please try again.",
  ),
);

router.post("/edit", async (req, res) => {
  try {
    const {
      id,
      fullname,
      email,
      address,
      date_of_birth,
      role,
      email_verified,
    } = req.body;

    const updateData = {
      fullname,
      email,
      address,
      date_of_birth: date_of_birth || null,
      role,
      email_verified: email_verified === "true",
      updated_at: new Date(),
    };

    await userModel.update(id, updateData);
    req.session.success_message = "User updated successfully!";
    res.redirect("/admin/users/list");
  } catch (error) {
    console.error("Update user error:", error);
    req.session.error_message = "Failed to update user. Please try again.";
    res.redirect(`/admin/users/edit/${req.body.id}`);
  }
});

router.post(
  "/delete",
  catchAsync(
    async (req, res) => {
      await userModel.deleteUser(req.body.id);
      req.session.success_message = "User deleted successfully!";
      res.redirect("/admin/users/list");
    },
    "/admin/users/list",
    "Failed to delete user. Please try again.",
  ),
);

// Route Reset Password
router.post(
  "/reset-password",
  catchAsync(
    async (req, res) => {
      const { id } = req.body;
      const defaultPassword = "123";
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      const user = await userModel.findById(id);

      await userModel.update(id, {
        password_hash: hashedPassword,
        updated_at: new Date(),
      });

      // Tách hàm gửi mail ra để code không bị lõm (nested)
      if (user && user.email) {
        sendResetEmail(user.email, user.fullname, defaultPassword).catch(
          (err) => console.error("Failed to send password reset email:", err),
        ); // Không await để tránh block luồng chạy chính nếu mail lỗi
      }

      req.session.success_message = `Password of ${user.fullname} reset successfully to default: 123`;
      res.redirect(`/admin/users/list`);
    },
    "/admin/users/list",
    "Failed to reset password.",
  ),
);

// Upgrade Requests
router.get("/upgrade-requests", async (req, res) => {
  const requests = await upgradeRequestModel.loadAllUpgradeRequests();
  res.render("vwAdmin/users/upgradeRequests", { requests });
});

router.post("/upgrade/approve", async (req, res) => {
  const id = req.body.id;
  const bidderId = req.body.bidder_id;
  // Logic to approve the upgrade request
  await upgradeRequestModel.approveUpgradeRequest(id);
  await userModel.updateUserRoleToSeller(bidderId);
  res.redirect("/admin/users/upgrade-requests");
});

router.post("/upgrade/reject", async (req, res) => {
  const id = req.body.id;
  const admin_note = req.body.admin_note;
  await upgradeRequestModel.rejectUpgradeRequest(id, admin_note);
  // Logic to reject the upgrade request
  res.redirect("/admin/users/upgrade-requests");
});

// Hàm gửi email được tách ra ngoài để giữ cho router gọn gàng
async function sendResetEmail(email, fullname, defaultPassword) {
  return sendMail({
    to: email,
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

export default router;
