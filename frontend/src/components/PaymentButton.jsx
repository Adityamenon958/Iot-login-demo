import React from 'react';
import axios from 'axios';

export default function PaymentButton({ amount }) {
  const loadRazorpay = async () => {
    try {
      const { data: order } = await axios.post("/api/payment/order", { amount });

      const options = {
        key: "rzp_test_jBIMs968bslFfa", // 🔁 Replace with your Razorpay TEST key
        amount: order.amount,
        currency: order.currency,
        name: "IoT Dashboard Subscription",
        description: `Pay ₹${amount} for Subscription`,
        order_id: order.id,
        handler: function (response) {
          alert("✅ Payment Successful!");
          console.log("Payment Response:", response);

          // OPTIONAL: You can POST this response to backend for verification
        },
        theme: {
          color: "#4db3b3",
        },
      };

      const razor = new window.Razorpay(options);
      razor.open();
    } catch (err) {
      console.error("❌ Razorpay error", err);
      alert("Failed to initiate payment");
    }
  };

  return (
    <button className="btn btn-primary mt-3" onClick={loadRazorpay}>
      Pay ₹{amount}
    </button>
  );
}
