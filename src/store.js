const { MongoClient, ObjectId } = require("mongodb");
const { randomUUID } = require("crypto");

function createMemoryStore() {
  const contacts = new Map();

  return {
    kind: "memory",
    async list(filter) {
      let items = [...contacts.values()];
      if (filter) {
        const needle = filter.toLowerCase();
        items = items.filter(
          (item) =>
            item.name.toLowerCase().includes(needle) ||
            item.phone.toLowerCase().includes(needle)
        );
      }
      return items.sort((a, b) => a.name.localeCompare(b.name));
    },
    async get(uid) {
      return contacts.get(uid) || null;
    },
    async create(payload) {
      const contact = { uid: randomUUID(), ...payload, createdAt: new Date().toISOString() };
      contacts.set(contact.uid, contact);
      return contact;
    },
    async update(uid, payload) {
      const current = contacts.get(uid);
      if (!current) return null;
      const updated = { ...current, ...payload, uid: current.uid, createdAt: current.createdAt };
      contacts.set(uid, updated);
      return updated;
    },
    async remove(uid) {
      return contacts.delete(uid);
    },
    async close() {}
  };
}

async function createMongoStore(uri, dbName) {
  const client = new MongoClient(uri);
  await client.connect();
  const collection = client.db(dbName).collection("contacts");
  await collection.createIndex({ name: 1 });

  const toContact = (doc) =>
    doc && {
      uid: doc._id.toString(),
      name: doc.name,
      phone: doc.phone,
      email: doc.email ?? null,
      note: doc.note ?? null,
      createdAt: doc.createdAt
    };

  const toObjectId = (uid) => (ObjectId.isValid(uid) ? new ObjectId(uid) : null);

  return {
    kind: "mongodb",
    async list(filter) {
      const query = filter
        ? { $or: [{ name: { $regex: filter, $options: "i" } }, { phone: { $regex: filter, $options: "i" } }] }
        : {};
      const docs = await collection.find(query).sort({ name: 1 }).toArray();
      return docs.map(toContact);
    },
    async get(uid) {
      const id = toObjectId(uid);
      if (!id) return null;
      return toContact(await collection.findOne({ _id: id }));
    },
    async create(payload) {
      const doc = { ...payload, createdAt: new Date().toISOString() };
      const result = await collection.insertOne(doc);
      return toContact({ ...doc, _id: result.insertedId });
    },
    async update(uid, payload) {
      const id = toObjectId(uid);
      if (!id) return null;
      const result = await collection.findOneAndUpdate(
        { _id: id },
        { $set: payload },
        { returnDocument: "after" }
      );
      return toContact(result);
    },
    async remove(uid) {
      const id = toObjectId(uid);
      if (!id) return false;
      const result = await collection.deleteOne({ _id: id });
      return result.deletedCount === 1;
    },
    async close() {
      await client.close();
    }
  };
}

async function createStore() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI is not set, falling back to an in-memory store");
    return createMemoryStore();
  }
  return createMongoStore(uri, process.env.MONGODB_DB || "lab5");
}

module.exports = { createStore };
