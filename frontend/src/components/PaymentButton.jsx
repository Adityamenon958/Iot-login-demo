import React from 'react';
import axios from 'axios';

export default function PaymentButton({ amount }) {
  const loadRazorpay = async () => {
    try {
      // Determine the plan type from the amount
      let planType;
      if (amount === 99) planType = "standard";
      else if (amount === 199) planType = "premium";
      else {
        alert("Invalid plan amount selected");
        return;
      }

      // Request backend to create Razorpay subscription
      const { data: subscription } = await axios.post("/api/payment/subscription", {
        planType,
      });

      const options = {
        key: "rzp_test_jBIMs968bslFfa", // ✅ Use your Razorpay TEST key
        name: "IoT Dashboard Subscription",
        description: `Monthly ${planType} plan`,
        subscription_id: subscription.id, // 🔑 Required for recurring
        handler: function (response) {
          alert("✅ Subscription started successfully!");
          console.log("Subscription Response:", response);
          // You can send this response to backend if needed
        },
        theme: {
          color: "#4db3b3",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("❌ Razorpay subscription error", err);
      alert("Failed to initiate subscription");
    }
  };

  return (
    <button className="btn btn-primary mt-3" onClick={loadRazorpay}>
      Subscribe for ₹{amount}/month
    </button>
  );
}
