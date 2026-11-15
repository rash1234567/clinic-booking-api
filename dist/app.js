"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = require("./middleware/auth");
const slots_1 = __importDefault(require("./routes/slots"));
const bookings_1 = __importDefault(require("./routes/bookings"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(auth_1.authenticate);
app.use(slots_1.default);
app.use(bookings_1.default);
app.use((req, res) => {
    res.status(404).json({ error: 'not found' });
});
exports.default = app;
