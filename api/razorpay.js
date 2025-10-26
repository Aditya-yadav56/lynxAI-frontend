import express from "express";
import Razorpay from "razorpay";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const razorpay = new Razorpay({
  key_id: "rzp_test_RXvVfYiWIjkUTz",
  key_secret: "INT7DetaMPM1tcjxN2TrUz9a",
});

app.post("/create-order", async (req, res) => {
  const options = {
    amount: req.body.amount * 100, // convert to paise
    currency: "INR",
    receipt: "receipt#1",
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));
