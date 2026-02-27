export const catchAsync = (
  fn,
  errorRedirectUrl = "/admin/users/list",
  customErrorMessage = "An error occurred. Please try again.",
) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error("Caught Error:", error);
      req.session.error_message = customErrorMessage;
      res.redirect(errorRedirectUrl);
    });
  };
};
