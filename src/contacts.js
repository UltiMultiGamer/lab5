const express = require("express");

const PHONE_PATTERN = /^\+?[0-9 ()-]{5,20}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validate(body, partial) {
  const errors = [];
  const payload = {};

  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);

  if (has("name") || !partial) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      errors.push({ field: "name", message: "Name must be between 2 and 80 characters" });
    } else {
      payload.name = name;
    }
  }

  if (has("phone") || !partial) {
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!PHONE_PATTERN.test(phone)) {
      errors.push({ field: "phone", message: "Phone must match +?[0-9 ()-] and be 5 to 20 characters" });
    } else {
      payload.phone = phone;
    }
  }

  if (has("email")) {
    if (body.email === null || body.email === "") {
      payload.email = null;
    } else if (typeof body.email !== "string" || !EMAIL_PATTERN.test(body.email.trim())) {
      errors.push({ field: "email", message: "Email is malformed" });
    } else {
      payload.email = body.email.trim();
    }
  }

  if (has("note")) {
    if (body.note === null || body.note === "") {
      payload.note = null;
    } else if (typeof body.note !== "string" || body.note.length > 500) {
      errors.push({ field: "note", message: "Note must be a string of at most 500 characters" });
    } else {
      payload.note = body.note.trim();
    }
  }

  return { errors, payload };
}

function createRouter(store) {
  const router = express.Router();

  router.get("/contact", async (req, res, next) => {
    try {
      const items = await store.list(req.query.q ? String(req.query.q).trim() : null);
      res.json({ total: items.length, items });
    } catch (error) {
      next(error);
    }
  });

  router.post("/contact", async (req, res, next) => {
    try {
      const { errors, payload } = validate(req.body || {}, false);
      if (errors.length) {
        res.status(422).json({ error: "Validation failed", details: errors });
        return;
      }
      const contact = await store.create({
        name: payload.name,
        phone: payload.phone,
        email: payload.email ?? null,
        note: payload.note ?? null
      });
      res.status(201).location("/v1/contact/" + contact.uid).json(contact);
    } catch (error) {
      next(error);
    }
  });

  router.get("/contact/:uid", async (req, res, next) => {
    try {
      const contact = await store.get(req.params.uid);
      if (!contact) {
        res.status(404).json({ error: "Contact not found" });
        return;
      }
      res.json(contact);
    } catch (error) {
      next(error);
    }
  });

  router.put("/contact/:uid", async (req, res, next) => {
    try {
      const { errors, payload } = validate(req.body || {}, false);
      if (errors.length) {
        res.status(422).json({ error: "Validation failed", details: errors });
        return;
      }
      const contact = await store.update(req.params.uid, {
        name: payload.name,
        phone: payload.phone,
        email: payload.email ?? null,
        note: payload.note ?? null
      });
      if (!contact) {
        res.status(404).json({ error: "Contact not found" });
        return;
      }
      res.json(contact);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/contact/:uid", async (req, res, next) => {
    try {
      const { errors, payload } = validate(req.body || {}, true);
      if (errors.length) {
        res.status(422).json({ error: "Validation failed", details: errors });
        return;
      }
      if (!Object.keys(payload).length) {
        res.status(422).json({ error: "Validation failed", details: [{ field: "body", message: "No updatable fields supplied" }] });
        return;
      }
      const contact = await store.update(req.params.uid, payload);
      if (!contact) {
        res.status(404).json({ error: "Contact not found" });
        return;
      }
      res.json(contact);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/contact/:uid", async (req, res, next) => {
    try {
      const removed = await store.remove(req.params.uid);
      if (!removed) {
        res.status(404).json({ error: "Contact not found" });
        return;
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createRouter };
