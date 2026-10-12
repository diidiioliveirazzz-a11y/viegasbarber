const session = require("express-session");
const { db } = require("./db");

/**
 * Persistent session store for Express using the NoSQL database adapter.
 * Ensures client and barber sessions survive server restarts, idle sleeps,
 * and redeployments so users stay logged in on mobile and desktop devices.
 */
class NoSQLSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.ttl = options.ttl || 365 * 24 * 60 * 60 * 1000; // 1 year default
  }

  getCollection() {
    return db.sessions();
  }

  get(sid, callback) {
    try {
      const col = this.getCollection();
      col
        .findOne({ sid })
        .then((record) => {
          if (!record) return callback(null, null);

          // Check expiration
          if (record.expires && new Date(record.expires).getTime() < Date.now()) {
            return this.destroy(sid, () => callback(null, null));
          }

          let sess = record.session;
          if (typeof sess === "string") {
            try {
              sess = JSON.parse(sess);
            } catch (err) {
              return callback(err);
            }
          }
          return callback(null, sess);
        })
        .catch((err) => callback(err));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sess, callback) {
    try {
      const col = this.getCollection();
      let expires = null;
      if (sess && sess.cookie && sess.cookie.expires) {
        expires = new Date(sess.cookie.expires).toISOString();
      } else {
        expires = new Date(Date.now() + this.ttl).toISOString();
      }

      const sessionData = cloneSafe(sess);

      col
        .updateOne(
          { sid },
          {
            $set: {
              sid,
              session: sessionData,
              expires,
              updated_at: new Date().toISOString(),
            },
          },
          { upsert: true }
        )
        .then(() => callback(null))
        .catch((err) => callback(err));
    } catch (err) {
      callback(err);
    }
  }

  touch(sid, sess, callback) {
    try {
      const col = this.getCollection();
      let expires = null;
      if (sess && sess.cookie && sess.cookie.expires) {
        expires = new Date(sess.cookie.expires).toISOString();
      } else {
        expires = new Date(Date.now() + this.ttl).toISOString();
      }

      col
        .updateOne(
          { sid },
          {
            $set: {
              expires,
              updated_at: new Date().toISOString(),
            },
          }
        )
        .then(() => callback(null))
        .catch((err) => callback(err));
    } catch (err) {
      callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      const col = this.getCollection();
      col
        .deleteOne({ sid })
        .then(() => callback && callback(null))
        .catch((err) => callback && callback(err));
    } catch (err) {
      callback && callback(err);
    }
  }

  all(callback) {
    try {
      const col = this.getCollection();
      col
        .find({})
        .toArray()
        .then((records) => {
          const sessions = {};
          for (const r of records) {
            sessions[r.sid] = typeof r.session === "string" ? JSON.parse(r.session) : r.session;
          }
          callback(null, sessions);
        })
        .catch((err) => callback(err));
    } catch (err) {
      callback(err);
    }
  }

  length(callback) {
    try {
      const col = this.getCollection();
      col
        .countDocuments({})
        .then((count) => callback(null, count))
        .catch((err) => callback(err));
    } catch (err) {
      callback(err);
    }
  }

  clear(callback) {
    try {
      const col = this.getCollection();
      col
        .deleteMany({})
        .then(() => callback && callback(null))
        .catch((err) => callback && callback(err));
    } catch (err) {
      callback && callback(err);
    }
  }
}

function cloneSafe(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

module.exports = NoSQLSessionStore;
