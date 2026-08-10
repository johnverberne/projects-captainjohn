function isAuthenticated(req, res, next) {
  if (req.session && req.session.email) {
    return next();
  }
  res.status(401).json({ error: "Session expired" });
}

function publicUser(user) {
  if (!user) return null;
  const obj = typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete obj.pw;
  return obj;
}

module.exports = { isAuthenticated, publicUser };
