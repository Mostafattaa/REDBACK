'use strict';

const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5 min default TTL

const get = (key) => cache.get(key);

const set = (key, value, ttl = 300) => cache.set(key, value, ttl);

const del = (key) => cache.del(key);

const delPrefix = (prefix) => {
  const keys = cache.keys();
  const targets = keys.filter(k => k.startsWith(prefix));
  if (targets.length > 0) {
    cache.del(targets);
  }
};

const flush = () => cache.flushAll();

module.exports = { get, set, del, delPrefix, flush };

