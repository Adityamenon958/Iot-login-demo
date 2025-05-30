import React from 'react';
import axios from 'axios';
import styles from "../pages/MainContent.module.css";
export default function PaymentButton({ amount }) {
  const loadRazorpay = async () => {
    try {
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
        key: "rzp_test_jBIMs968bslFfa",
        name: "IoT Dashboard Subscription",
        description: `Monthly ${planType} plan`,
        subscription_id: subscription.id,
        handler: async function (response) {
            alert("✅ Subscription started successfully!");
            console.log("Subscription Response:", response);
          
            const razorpaySubscriptionId = response.razorpay_subscription_id;
          
            try {
              // ✅ 1. Activate subscription in DB
              await axios.post("/api/payment/activate-subscription", {
                subscriptionId: response.razorpay_subscription_id,
              }, { withCredentials: true });
          
              // ✅ 2. Re-issue JWT with updated subscription info
              await axios.post("/api/auth/update-subscription", {}, { withCredentials: true });
          
              // ✅ 3. Optional: Refresh page to re-render buttons
              window.location.reload();
          
            } catch (activationError) {
              console.error("❌ Activation error:", activationError);
              alert("❌ Failed to activate access. Please contact support.");
            }
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
    <button className={`${styles.subscribeBtn} mt-3`} onClick={loadRazorpay}>
      Subscribe for ₹{amount}/month
    </button>
  );
}
