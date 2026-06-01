'use strict';

const { ForbiddenError } = require('../utils/errors');

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ForbiddenError('You do not have permission to perform this action'));
  }
  next();
};

module.exports = authorize;
