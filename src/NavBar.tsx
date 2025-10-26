import React, { useState, useEffect } from "react";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { SidebarTrigger } from "./components/ui/sidebar";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "./components/ui/label";
import { Input } from "./components/ui/input";
import { Check, Sparkles, Zap, Crown } from "lucide-react";

import { auth } from "@/(auth)/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

const NavBar = ({ inChat = false, onNewChat }: { inChat?: boolean; onNewChat?: () => void }) => {
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirm, setSignUpConfirm] = useState("");
  const [user, setUser] = useState(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [currency, setCurrency] = useState({ symbol: "₹", code: "INR", price: 99, originalPrice: 399 });

  // Detect user's country and set currency
  useEffect(() => {
    const detectCurrency = async () => {
      try {
        // Try to get user's location via IP geolocation
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        if (data.country_code === 'IN') {
          setCurrency({ symbol: "₹", code: "INR", price: 99, originalPrice: 399 });
        } else {
          // For all other countries, show USD
          setCurrency({ symbol: "$", code: "USD", price: 2, originalPrice: 8 });
        }
      } catch (error) {
        console.error("Currency detection failed, defaulting to INR:", error);
        // Default to INR if detection fails
        setCurrency({ symbol: "₹", code: "INR", price: 99, originalPrice: 399 });
      }
    };

    detectCurrency();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleAuth = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("Google user:", result.user);
      setSignInOpen(false);
      setSignUpOpen(false);
    } catch (error) {
      console.error("Google Auth Error:", error.message);
    }
  };

  const handleSignUp = async () => {
    if (signUpPassword !== signUpConfirm) {
      alert("Passwords do not match!");
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        signUpEmail,
        signUpPassword
      );
      console.log("User signed up:", userCredential.user);
      setSignUpOpen(false);
      setSignUpEmail("");
      setSignUpPassword("");
      setSignUpConfirm("");
    } catch (error) {
      console.error("Sign Up Error:", error.message);
      alert(error.message);
    }
  };

  const handleSignIn = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        signInEmail,
        signInPassword
      );
      console.log("User signed in:", userCredential.user);
      setSignInOpen(false);
      setSignInEmail("");
      setSignInPassword("");
    } catch (error) {
      console.error("Sign In Error:", error.message);
      alert(error.message);
    }
  };

  const handleSubscribe = async () => {
  if (!user) {
    setPricingOpen(false);
    setSignUpOpen(true);
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 99 }), // ₹99 for Pro
    });
    const order = await res.json();

    const options = {
      key: "rzp_test_RXvVfYiWIjkUTz", // only key_id
      amount: order.amount,
      currency: order.currency,
      name: "Lynx AI",
      description: "Pro Plan",
      order_id: order.id,
      handler: function (response) {
        alert("Payment successful! 🎉");
        console.log(response); // contains payment_id, order_id, signature
      },
      prefill: {
        name: user.displayName || "User",
        email: user.email,
      },
      theme: { color: "#7c3aed" },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  } catch (err) {
    console.error(err);
    alert("Payment failed, check console!");
  }
};


  return (
    <div className="sticky top-3 z-50 flex justify-center mt-3">
      <SidebarTrigger className="left-5 absolute" />
      <div className="absolute tracking-wider font-coolvetica right-5 flex gap-5">
        {user ? (
          <Button variant="outline" onClick={handleSignOut}>
            Logout
          </Button>
        ) : (
          <>
            {/* Sign In Dialog */}
            <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Sign In</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Sign In</DialogTitle>
                  <DialogDescription>
                    Enter your credentials to access your account.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleAuth}
                  >
                    Continue with Google
                  </Button>

                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSignIn()}
                  />
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSignIn()}
                  />
                </div>

                <DialogFooter className="sm:justify-between">
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleSignIn}>Sign In</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Sign Up Dialog */}
            <Dialog open={signUpOpen} onOpenChange={setSignUpOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Sign Up</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Sign Up</DialogTitle>
                  <DialogDescription>
                    Create a new account to get started.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleAuth}
                  >
                    Continue with Google
                  </Button>

                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                  />
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="Create a password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                  />
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    placeholder="Confirm your password"
                    value={signUpConfirm}
                    onChange={(e) => setSignUpConfirm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSignUp()}
                  />
                </div>

                <DialogFooter className="sm:justify-between">
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleSignUp}>Create Account</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {inChat && onNewChat && (
          <Button variant="default" onClick={onNewChat}>
            + New Chat
          </Button>
        )}
      </div>

      {!inChat && (
        <NavigationMenu className="flex-wrap">
          <NavigationMenuList>
            <NavigationMenuItem>
              <div className="flex gap-1">
                <NavigationMenuLink href="/">Home</NavigationMenuLink>
                <NavigationMenuLink href="/">Settings</NavigationMenuLink>
                <NavigationMenuLink href="/">About</NavigationMenuLink>
                <NavigationMenuLink href="/">API</NavigationMenuLink>
                <button
                  onClick={() => setPricingOpen(true)}
                  className="inline-flex h-9 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
                >
                  Pricing
                </button>
              </div>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      )}

      {/* Pricing Dialog */}
      <Dialog open={pricingOpen} onOpenChange={setPricingOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              Choose Your Plan
            </DialogTitle>
            <DialogDescription className="text-center">
              Unlock the full potential of Lynx AI
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-6 py-6">
            {/* Free Plan */}
            <div className="border rounded-2xl p-6 space-y-4 hover:border-gray-600 transition">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-gray-400" />
                  <h3 className="text-xl font-semibold">Free</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">₹0</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <p className="text-sm text-gray-500">Perfect for getting started</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span className="text-sm">Basic AI responses</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span className="text-sm">10 messages per day</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span className="text-sm">Standard response time</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span className="text-sm">Basic personality customization</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" disabled>
                Current Plan
              </Button>
            </div>

            {/* Pro Plan */}
            <div className="border-2 border-purple-500 rounded-2xl p-6 space-y-4 bg-purple-500/5 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-purple-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                  RECOMMENDED
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-purple-400" />
                  <h3 className="text-xl font-semibold">Pro</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">₹99</span>
                  <span className="text-gray-500">/month</span>
                  <p className="text-purple-400 line-through font-bold">₹399/month</p>
                </div>
                <p className="text-sm text-gray-500">For power users and professionals</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5" />
                  <span className="text-sm font-medium">Everything in Free, plus:</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5" />
                  <span className="text-sm">Unlimited messages</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5" />
                  <span className="text-sm">Advanced AI modes (Thinking & Web Search)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5" />
                  <span className="text-sm">Priority response time</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5" />
                  <span className="text-sm">Advanced personality templates</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5" />
                  <span className="text-sm">Save unlimited conversations</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5" />
                  <span className="text-sm">Export conversations (PDF/Text)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-purple-400 mt-0.5" />
                  <span className="text-sm">Priority support</span>
                </div>
              </div>

              <Button 
                className="w-full bg-purple-500 hover:bg-purple-600" 
                onClick={handleSubscribe}
              >
                <Zap className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
            </div>
          </div>

          <div className="text-center text-xs text-gray-500 pt-4 border-t">
            <p>All plans include 7-day money-back guarantee</p>
            <p className="mt-1">Cancel anytime, no questions asked</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NavBar;