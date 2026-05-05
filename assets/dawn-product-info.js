function initProductTabs() {
  const buttons = document.querySelectorAll(".details-button");
  const tabs = {
    details: document.getElementById("details-tab"),
    packaging: document.getElementById("packaging-tab"),
    shipping: document.getElementById("shipping-tab"),
  };

  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const selected = btn.dataset.tab;

      if (selected === "faq") {
        const faqSection =
          document.getElementById("productFaqSection") ||
          document.getElementById("faq") ||
          document.querySelector(".faq-section");

        if (faqSection) {
          faqSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }

      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      Object.values(tabs).forEach((tab) => {
        if (tab) tab.style.display = "none";
      });

      if (tabs[selected]) tabs[selected].style.display = "block";
    });
  });
}

function getReviewsSectionTarget() {
  const selectorCandidates = [
    "#judgeme_product_reviews",
    ".jdgm-widget.jdgm-review-widget",
    ".jdgm-widget",
    ".reviews-section",
    "#shopify-product-reviews",
    "#product-reviews",
    "[id*='judgeme']",
    "[id*='review_widget']",
    "[class*='jdgm']",
  ];

  for (const selector of selectorCandidates) {
    const found = document.querySelector(selector);
    if (found) return found;
  }

  const appSection = Array.from(document.querySelectorAll(".shopify-section")).find(
    (section) =>
      section.id.includes("judge_me_reviews_review_widget") || section.querySelector(".jdgm-widget")
  );

  return appSection || null;
}

function initRatingWrapScroll() {
  const ratingWraps = document.querySelectorAll(".rating-wrap");
  if (!ratingWraps.length) return;

  const goToReviews = () => {
    const target = getReviewsSectionTarget();
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  ratingWraps.forEach((wrap) => {
    if (wrap.dataset.reviewScrollBound === "true") return;
    wrap.dataset.reviewScrollBound = "true";

    wrap.addEventListener("click", goToReviews);
    wrap.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        goToReviews();
      }
    });
  });
}

function initQuantityBox() {
  const minusBtn = document.querySelector(".qty-btn.minus");
  const plusBtn = document.querySelector(".qty-btn.plus");
  const qtyInput = document.querySelector(".quantity-input");

  if (!qtyInput || !minusBtn || !plusBtn) return;

  minusBtn.addEventListener("click", () => {
    let currentValue = parseInt(qtyInput.value);
    if (currentValue > 1) {
      qtyInput.value = currentValue - 1;
      qtyInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  plusBtn.addEventListener("click", () => {
    let currentValue = parseInt(qtyInput.value);
    qtyInput.value = currentValue + 1;
    qtyInput.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

// Function to apply discount code to cart
async function applyDiscountCode(discountCode) {
  try {
    // Get current cart to check existing discounts
    const cartResponse = await fetch('/cart.js');
    const cart = await cartResponse.json();
    
    // Check if discount already applied
    const existingDiscounts = cart.cart_level_discount_applications
      .filter(d => d.type === 'discount_code')
      .map(d => d.title);
    
    if (existingDiscounts.includes(discountCode)) {
      console.log('Discount already applied');
      return true;
    }

    // Apply discount code using cart update
    const response = await fetch('/cart/update.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        discount: discountCode
      })
    });

    if (response.ok) {
      const updatedCart = await response.json();
      console.log('Discount code applied:', discountCode, updatedCart);
      
      // Trigger cart refresh event
      document.dispatchEvent(new CustomEvent('cart:refresh', {
        detail: { cart: updatedCart }
      }));
      
      return true;
    } else {
      console.error('Failed to apply discount code');
      return false;
    }
  } catch (error) {
    console.error('Error applying discount:', error);
    return false;
  }
}

function initOfferSelector() {
  const offerOptions = document.querySelectorAll('.offer-option');
  const productForm = document.getElementById('product-form');

  if (!productForm) return;
  if (productForm.dataset.offerHandlerBound === 'true') return;
  productForm.dataset.offerHandlerBound = 'true';

  // Handle offer selection
  if (offerOptions.length) {
    offerOptions.forEach(option => {
      const radio = option.querySelector('input[type="radio"]');

      option.addEventListener('click', () => {
        document.querySelectorAll('.offer-option input[type="radio"]').forEach(r => {
          r.checked = false;
        });
        radio.checked = true;
        offerOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        document.dispatchEvent(new Event('sticky:offer-change'));
      });
    });
  }

  // Handle form submission
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const selectedOffer = document.querySelector('.offer-option input[type="radio"]:checked');
    const variantSelect = document.getElementById('variant-select');
    const quantityInput = document.getElementById('quantity-input');
    const submitButton = productForm.querySelector('button[type="submit"]');
    
    if (!variantSelect || !quantityInput) return;

    const offerType = selectedOffer ? selectedOffer.value : 'buy1';
    const variantId = variantSelect.value;
    const baseQuantity = parseInt(quantityInput.value) || 1;
    let finalQuantity = offerType === 'bogo' ? baseQuantity * 2 : baseQuantity;

    // Update button state
    const originalText = submitButton ? submitButton.textContent : '';
    if (submitButton) {
      submitButton.textContent = 'Adding...';
      submitButton.disabled = true;
    }

    // Prepare form data
    const formData = new FormData();
    formData.append('id', variantId);
    formData.append('quantity', String(finalQuantity));
    
    if (offerType === 'bogo') {
      formData.append('properties[_offer_type]', offerType);
      formData.append('properties[_original_quantity]', String(baseQuantity));
      formData.append('properties[_discount_code]', window.productDiscountCode || 'Off10');
    }

    try {
      if (offerType === 'bogo') {
        // BOGO Flow: Add items separately to show the proper flow
        
        // Step 1: Add first item
        const firstItemData = new FormData();
        firstItemData.append('id', variantId);
        firstItemData.append('quantity', baseQuantity);
        firstItemData.append('properties[_offer_type]', 'bogo');
        firstItemData.append('properties[_original_quantity]', baseQuantity);
        firstItemData.append('properties[_bogo_item]', '1');
        firstItemData.append('properties[_discount_code]', window.productDiscountCode || 'Off10');

        const firstResponse = await fetch('/cart/add.js', {
          method: 'POST',
          body: firstItemData
        });

        if (!firstResponse.ok) {
          const error = await firstResponse.json();
          throw new Error(error.description || 'Failed to add to cart');
        }

        // Open cart drawer after first item
        const cartDrawer = document.querySelector('cart-drawer-component');
        if (cartDrawer && typeof cartDrawer.open === 'function') {
          cartDrawer.open();
        }

        // Refresh cart to show first item
        if (typeof window.refreshCartContent === 'function') {
          await window.refreshCartContent();
        }

        // Update button to show progress
        if (submitButton) {
          submitButton.textContent = 'Adding 2nd item...';
        }

        // Wait 800ms before adding second item
        await new Promise(resolve => setTimeout(resolve, 800));

        // Step 2: Add second item (the free/discounted one)
        const secondItemData = new FormData();
        secondItemData.append('id', variantId);
        secondItemData.append('quantity', baseQuantity);
        secondItemData.append('properties[_offer_type]', 'bogo');
        secondItemData.append('properties[_original_quantity]', baseQuantity);
        secondItemData.append('properties[_bogo_item]', '2');
        secondItemData.append('properties[_discount_code]', window.productDiscountCode || 'Off10');

        const secondResponse = await fetch('/cart/add.js', {
          method: 'POST',
          body: secondItemData
        });

        if (!secondResponse.ok) {
          const error = await secondResponse.json();
          throw new Error(error.description || 'Failed to add second item');
        }

        // Refresh cart to show both items
        if (typeof window.refreshCartContent === 'function') {
          await window.refreshCartContent();
        }

        // Apply BOGO discount code
        await new Promise(resolve => setTimeout(resolve, 500));
        await applyDiscountCode(window.productDiscountCode || 'Off10');

        // Final refresh to show discount applied
        if (typeof window.refreshCartContent === 'function') {
          await window.refreshCartContent();
        }

        // Update button to show success
        if (submitButton) {
          submitButton.textContent = 'Added!';
        }

      } else {
        // Regular Buy 1 Flow: Add single item
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.description || 'Failed to add to cart');
        }

        // Update button to show success
        if (submitButton) {
          submitButton.textContent = 'Added!';
        }

        // Open cart drawer
        const cartDrawer = document.querySelector('cart-drawer-component');
        if (cartDrawer && typeof cartDrawer.open === 'function') {
          cartDrawer.open();
        }

        // Refresh cart content
        if (typeof window.refreshCartContent === 'function') {
          await window.refreshCartContent();
        }
      }

      // Reset button after 2 seconds
      setTimeout(() => {
        if (submitButton) {
          submitButton.textContent = originalText;
          submitButton.disabled = false;
        }
      }, 2000);

    } catch (error) {
      console.error('Add to cart error:', error);
      if (submitButton) {
        submitButton.textContent = error.message.includes('stock') ? 'Out of stock' : 'Error';
        setTimeout(() => {
          submitButton.textContent = originalText;
          submitButton.disabled = false;
        }, 2000);
      }
    }
  });
}

function initVariantSelector() {
  const variantSelect = document.getElementById("variant-select");
  const productForm = document.querySelector("form.product-form");
  const sizeSelect = document.getElementById("size-variant-select");
  const hiddenVariantInput = productForm ? productForm.querySelector('input[type="hidden"][name="id"]') : null;

  if (!variantSelect || !productForm) return;
  if (variantSelect.dataset.variantSelectorBound === "true") return;
  variantSelect.dataset.variantSelectorBound = "true";

  // Update URL and price when variant changes
  variantSelect.addEventListener("change", (e) => {
    const selectedVariantId = e.target.value;
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("variant", selectedVariantId);
    window.history.replaceState({}, "", newUrl);

    const selectedOption = e.target.selectedOptions ? e.target.selectedOptions[0] : null;
    const variantPrice = Number(selectedOption?.dataset.price || 0);

    if (hiddenVariantInput) {
      hiddenVariantInput.value = selectedVariantId;
    }

    document.dispatchEvent(
      new CustomEvent("sticky:variant-change", {
        detail: { variantPrice },
      })
    );

    if (sizeSelect && selectedOption?.dataset.sizeValue && sizeSelect.value !== selectedOption.dataset.sizeValue) {
      sizeSelect.value = selectedOption.dataset.sizeValue;
    }

    console.log("Selected variant:", selectedVariantId);
  });

  if (sizeSelect && sizeSelect.dataset.sizeVariantSelectBound !== "true") {
    sizeSelect.dataset.sizeVariantSelectBound = "true";
    sizeSelect.addEventListener("change", () => {
      const requestedSize = sizeSelect.value;
      const options = Array.from(variantSelect.options);
      const sizeMatch =
        options.find(
          (option) =>
            option.dataset.sizeValue === requestedSize && option.dataset.available !== "false"
        ) || options.find((option) => option.dataset.sizeValue === requestedSize);

      if (!sizeMatch) return;
      variantSelect.value = sizeMatch.value;
      variantSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  const initialSelectedOption = variantSelect.selectedOptions ? variantSelect.selectedOptions[0] : null;
  const initialVariantPrice = Number(initialSelectedOption?.dataset.price || 0);
  document.dispatchEvent(
    new CustomEvent("sticky:variant-change", {
      detail: { variantPrice: initialVariantPrice },
    })
  );
}

function initBundleVariantCards() {
  const variantSelect = document.getElementById("variant-select");
  const variantCards = document.querySelectorAll(".bundle-variant-card");
  const sizeSelect = document.getElementById("size-variant-select");
  const stickyPriceEl = document.querySelector(".sticky-atc-price");

  if (!variantSelect || !variantCards.length) return;

  const allVariantOptions = Array.from(variantSelect.options);

  const formatMoney = (cents) => {
    const safeCents = Math.max(0, Math.round(Number(cents) || 0));

    if (
      stickyPriceEl &&
      stickyPriceEl.dataset.moneyFormat &&
      window.Shopify &&
      typeof window.Shopify.formatMoney === "function"
    ) {
      return window.Shopify
        .formatMoney(safeCents, stickyPriceEl.dataset.moneyFormat)
        .replace(/\.00(?=\D|$)/, "");
    }

    const currency = stickyPriceEl?.dataset.currency || "INR";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(safeCents / 100);
  };

  const setActiveCard = (bundleValue) => {
    variantCards.forEach((card) => {
      const isActive = card.dataset.bundleValue
        ? card.dataset.bundleValue === String(bundleValue)
        : card.dataset.variantId === String(bundleValue);

      card.classList.toggle("active", isActive);
      card.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const getMatchingOption = (sizeValue, bundleValue, requireAvailable) => {
    return allVariantOptions.find((option) => {
      const optionSize = option.dataset.sizeValue || "";
      const optionBundle = option.dataset.bundleValue || "";
      const isAvailable = option.dataset.available !== "false";

      const sizeMatch = !sizeValue || !optionSize || optionSize === sizeValue;
      const bundleMatch = !bundleValue || !optionBundle || optionBundle === bundleValue;
      const availabilityMatch = !requireAvailable || isAvailable;

      return sizeMatch && bundleMatch && availabilityMatch;
    }) || null;
  };

  const getCurrentSizeValue = () => {
    if (sizeSelect) return sizeSelect.value || "";
    const selectedOption = variantSelect.selectedOptions ? variantSelect.selectedOptions[0] : null;
    return selectedOption?.dataset.sizeValue || "";
  };

  const syncVariantSelection = () => {
    const sizeValue = getCurrentSizeValue();
    const activeCard = Array.from(variantCards).find((card) => card.classList.contains("active") && !card.disabled);
    const activeBundle = activeCard ? activeCard.dataset.bundleValue || "" : "";

    let nextOption =
      getMatchingOption(sizeValue, activeBundle, true) ||
      getMatchingOption(sizeValue, activeBundle, false);

    if (!nextOption) {
      const firstUsableCard = Array.from(variantCards).find((card) => !card.disabled);
      if (firstUsableCard) {
        const firstBundle = firstUsableCard.dataset.bundleValue || "";
        setActiveCard(firstBundle);
        nextOption =
          getMatchingOption(sizeValue, firstBundle, true) ||
          getMatchingOption(sizeValue, firstBundle, false);
      }
    }

    if (!nextOption) return;

    if (variantSelect.value !== nextOption.value) {
      variantSelect.value = nextOption.value;
      variantSelect.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      variantSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  const updateBundleCardsForSize = () => {
    const sizeValue = getCurrentSizeValue();

    variantCards.forEach((card) => {
      const bundleValue = card.dataset.bundleValue || "";
      const match =
        getMatchingOption(sizeValue, bundleValue, true) ||
        getMatchingOption(sizeValue, bundleValue, false);

      const priceEl = card.querySelector(".bundle-variant-price");
      const compareEl = card.querySelector(".bundle-variant-compare");
      const discountEl = card.querySelector(".bundle-variant-discount");
      const unitEl = card.querySelector(".bundle-variant-unit");

      if (!match) {
        card.disabled = true;
        if (priceEl) priceEl.textContent = "";
        if (compareEl) compareEl.textContent = "";
        if (discountEl) discountEl.textContent = "";
        if (unitEl) unitEl.textContent = "";
        card.classList.remove("active");
        card.setAttribute("aria-pressed", "false");
        return;
      }

      const priceCents = Number(match.dataset.price || 0);
      const compareCents = Number(match.dataset.comparePrice || 0);
      const unitPriceCents = Number(match.dataset.unitPrice || 0);
      const unitReference = match.dataset.unitReference || "";
      const isAvailable = match.dataset.available !== "false";

      card.disabled = !isAvailable;
      card.dataset.variantId = match.value;

      if (priceEl) priceEl.textContent = formatMoney(priceCents);

      if (compareEl) {
        compareEl.textContent = compareCents > priceCents ? formatMoney(compareCents) : "";
      }

      if (discountEl) {
        if (compareCents > priceCents) {
          const discount = Math.round(((compareCents - priceCents) * 100) / compareCents);
          discountEl.textContent = `${discount}% off`;
        } else {
          discountEl.textContent = "";
        }
      }

      if (unitEl) {
        unitEl.textContent =
          unitPriceCents > 0 && unitReference
            ? `${formatMoney(unitPriceCents)}/${unitReference}`
            : "";
      }
    });

    const activeCard = Array.from(variantCards).find((card) => card.classList.contains("active") && !card.disabled);
    if (!activeCard) {
      const firstUsableCard = Array.from(variantCards).find((card) => !card.disabled);
      if (firstUsableCard) {
        setActiveCard(firstUsableCard.dataset.bundleValue || firstUsableCard.dataset.variantId || "");
      }
    }
  };

  variantCards.forEach((card) => {
    if (card.dataset.variantCardBound === "true") return;
    card.dataset.variantCardBound = "true";

    card.addEventListener("click", () => {
      if (card.disabled) return;
      const nextValue = card.dataset.bundleValue || card.dataset.variantId;
      if (!nextValue) return;
      setActiveCard(nextValue);
      syncVariantSelection();
    });
  });

  if (sizeSelect && sizeSelect.dataset.sizeVariantBound !== "true") {
    sizeSelect.dataset.sizeVariantBound = "true";
    sizeSelect.addEventListener("change", () => {
      updateBundleCardsForSize();
      syncVariantSelection();
    });
  }

  if (variantSelect.dataset.variantCardsSyncBound !== "true") {
    variantSelect.dataset.variantCardsSyncBound = "true";
    variantSelect.addEventListener("change", () => {
      const selectedOption = variantSelect.selectedOptions ? variantSelect.selectedOptions[0] : null;
      if (!selectedOption) return;

      if (sizeSelect && selectedOption.dataset.sizeValue && sizeSelect.value !== selectedOption.dataset.sizeValue) {
        sizeSelect.value = selectedOption.dataset.sizeValue;
      }

      if (selectedOption.dataset.bundleValue) {
        setActiveCard(selectedOption.dataset.bundleValue);
      } else {
        setActiveCard(variantSelect.value);
      }
      updateBundleCardsForSize();
    });
  }

  updateBundleCardsForSize();
  const initialOption = variantSelect.selectedOptions ? variantSelect.selectedOptions[0] : null;
  if (initialOption && initialOption.dataset.bundleValue) {
    setActiveCard(initialOption.dataset.bundleValue);
  } else {
    setActiveCard(variantSelect.value);
  }
  syncVariantSelection();
}

function initDesktopCarousel() {
  const carouselMain = document.getElementById("carouselMainImage");
  const carouselThumbs = document.querySelectorAll(".carousel-thumb");
  const thumbnailsWrapper = document.querySelector(".carousel-thumbnails-wrapper");

  if (!carouselMain || carouselThumbs.length === 0) return;

  carouselThumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      // Remove active class from all thumbnails
      carouselThumbs.forEach((t) => t.classList.remove("active"));

      // Add active class to clicked thumbnail
      thumb.classList.add("active");

      // Scroll thumbnail into view
      if (thumbnailsWrapper) {
        thumb.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      // Update main image with fade effect
      const newSrc = thumb.dataset.image;
      carouselMain.style.opacity = "0";
      setTimeout(() => {
        carouselMain.src = newSrc;
        carouselMain.style.opacity = "1";
      }, 150);
    });
  });
}

function initMobileCarousel() {
  const mobileCarouselMain = document.getElementById("mobileCarouselMainImage");
  const mobileThumbs = document.querySelectorAll(".carousel-thumb-mobile");
  const thumbnailsWrapperMobile = document.querySelector(".carousel-thumbnails-wrapper-mobile");

  if (!mobileCarouselMain || mobileThumbs.length === 0) return;

  mobileThumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      // Remove active class from all thumbnails
      mobileThumbs.forEach((t) => t.classList.remove("active"));

      // Add active class to clicked thumbnail
      thumb.classList.add("active");

      // Scroll thumbnail into view
      if (thumbnailsWrapperMobile) {
        thumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }

      // Update main image with fade effect
      const newSrc = thumb.dataset.image;
      mobileCarouselMain.style.opacity = "0";
      setTimeout(() => {
        mobileCarouselMain.src = newSrc;
        mobileCarouselMain.style.opacity = "1";
      }, 150);
    });
  });
}

// Initialize on both normal load and Theme Editor load
function initProductInfoSection() {
  initProductTabs();
  initRatingWrapScroll();
  initQuantityBox();
  initOfferSelector();
  initVariantSelector();
  initBundleVariantCards();
  initDesktopCarousel();
  initMobileCarousel();
  initStickyAtc();
  initShareButton();
  initBuyNow();
}

// Buy Now Button Functionality
function initBuyNow() {
  const buyNowBtn = document.getElementById('buyNowBtn');
  if (!buyNowBtn) return;

  // Reset button state on page load (in case user came back via browser back button)
  const resetButton = () => {
    buyNowBtn.textContent = 'Buy Now';
    buyNowBtn.disabled = false;
  };

  // Reset on page show (handles back/forward navigation)
  window.addEventListener('pageshow', resetButton);

  buyNowBtn.addEventListener('click', async function() {
    const productForm = document.querySelector('.product-form');
    if (!productForm) return;
    
    const originalText = this.textContent;
    const selectedOffer = document.querySelector('.offer-option input[type="radio"]:checked');
    const variantSelect = document.getElementById('variant-select');
    const quantityInput = document.getElementById('quantity-input');
    
    if (!variantSelect || !quantityInput) return;

    const offerType = selectedOffer ? selectedOffer.value : 'buy1';
    const variantId = variantSelect.value;
    const baseQuantity = parseInt(quantityInput.value) || 1;
    const finalQuantity = offerType === 'bogo' ? baseQuantity * 2 : baseQuantity;
    
    this.textContent = 'Processing...';
    this.disabled = true;
    
    // Safety timeout to revert button after 5 seconds
    const safetyTimeout = setTimeout(() => {
      this.textContent = originalText;
      this.disabled = false;
    }, 5000);
    
    try {
      // Prepare form data with properties
      const formData = new FormData();
      formData.append('id', variantId);
      formData.append('quantity', String(finalQuantity));
      
      if (offerType === 'bogo') {
        formData.append('properties[_offer_type]', offerType);
        formData.append('properties[_original_quantity]', String(baseQuantity));
        formData.append('properties[_discount_code]', window.productDiscountCode || 'Off10');
      }
      
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.description || 'Failed to add to cart');
      }
      
      // Apply BOGO discount if needed
      if (offerType === 'bogo') {
        await applyDiscountCode(window.productDiscountCode || 'Off10');
      }
      
      // Clear safety timeout before redirect
      clearTimeout(safetyTimeout);
      
      // Redirect to checkout
      window.location.href = '/checkout';
      
    } catch (error) {
      console.error('Buy now error:', error);
      clearTimeout(safetyTimeout);
      this.textContent = error.message.includes('stock') ? 'Out of stock' : 'Error';
      setTimeout(() => {
        this.textContent = originalText;
        this.disabled = false;
      }, 2000);
    }
  });
}

// Share Button Functionality
function initShareButton() {
  const shareButton = document.getElementById('shareButton');
  
  if (!shareButton) return;

  shareButton.addEventListener('click', async () => {
    const shareData = {
      title: document.querySelector('.product-title')?.textContent || 'Check out this product',
      text: document.querySelector('.product-description')?.textContent?.substring(0, 100) || 'Check out this amazing product!',
      url: window.location.href
    };

    try {
      // Check if Web Share API is supported
      if (navigator.share) {
        await navigator.share(shareData);
        console.log('Product shared successfully');
      } else {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        
        // Show feedback
        const originalHTML = shareButton.innerHTML;
        shareButton.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 11L12 14L22 4" stroke="#1E1E1E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M21 12V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16" stroke="#1E1E1E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;
        
        setTimeout(() => {
          shareButton.innerHTML = originalHTML;
        }, 2000);
        
        console.log('Link copied to clipboard');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  });
}

document.addEventListener("DOMContentLoaded", initProductInfoSection);
document.addEventListener("shopify:section:load", initProductInfoSection);

// Sticky Add to Cart Bar
function initStickyAtc() {
  const stickyBar = document.getElementById('stickyAtcBar');
  const mainAtcButton = document.querySelector('.product-form .add-to-cart');
  const productForm = document.querySelector('.product-form');
  const stickyAddToCartBtn = document.getElementById('stickyAddToCart');
  const stickyQtyInput = document.getElementById('sticky-quantity-input');
  const mainQtyInput = document.querySelector('.quantity-input');
  const stickyPriceEl = document.querySelector('.sticky-atc-price');

  if (!stickyBar || !mainAtcButton) return;
  if (stickyBar.dataset.stickyAtcBound === 'true') return;
  stickyBar.dataset.stickyAtcBound = 'true';

  const normalizeQty = (value) => {
    const qty = parseInt(value, 10);
    if (!Number.isFinite(qty) || qty < 1) return 1;
    return qty;
  };

  const formatStickyMoney = (cents) => {
    const safeCents = Math.max(0, Math.round(Number(cents) || 0));

    if (
      stickyPriceEl &&
      stickyPriceEl.dataset.moneyFormat &&
      window.Shopify &&
      typeof window.Shopify.formatMoney === 'function'
    ) {
      return window.Shopify
        .formatMoney(safeCents, stickyPriceEl.dataset.moneyFormat)
        .replace(/\.00(?=\D|$)/, '');
    }

    const currency = stickyPriceEl?.dataset.currency || 'INR';
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(safeCents / 100);
  };

  const updateStickyPrice = () => {
    if (!stickyPriceEl || !stickyQtyInput) return;

    const basePriceCents = Number(stickyPriceEl.dataset.basePrice || 0);
    if (!Number.isFinite(basePriceCents) || basePriceCents <= 0) return;

    const qty = normalizeQty(stickyQtyInput.value);
    stickyQtyInput.value = String(qty);
    if (mainQtyInput) mainQtyInput.value = String(qty);

    const selectedOffer = document.querySelector('.offer-option input[type="radio"]:checked')?.value || 'buy1';

    let totalPriceCents = basePriceCents * qty;
    if (selectedOffer === 'bogo') {
      const secondUnitCents = Math.round(basePriceCents * 0.9);
      totalPriceCents = qty * (basePriceCents + secondUnitCents);
    }

    stickyPriceEl.textContent = formatStickyMoney(totalPriceCents);
  };

  // Sync sticky quantity with main quantity
  const stickyMinusBtn = document.querySelector('.sticky-qty-btn.minus');
  const stickyPlusBtn = document.querySelector('.sticky-qty-btn.plus');

  if (stickyMinusBtn && stickyQtyInput) {
    stickyMinusBtn.addEventListener('click', () => {
      let currentValue = normalizeQty(stickyQtyInput.value);
      if (currentValue > 1) {
        const nextValue = currentValue - 1;
        stickyQtyInput.value = nextValue;
        if (mainQtyInput) mainQtyInput.value = nextValue;
        updateStickyPrice();
      }
    });
  }

  if (stickyPlusBtn && stickyQtyInput) {
    stickyPlusBtn.addEventListener('click', () => {
      let currentValue = normalizeQty(stickyQtyInput.value);
      const nextValue = currentValue + 1;
      stickyQtyInput.value = nextValue;
      if (mainQtyInput) mainQtyInput.value = nextValue;
      updateStickyPrice();
    });
  }

  if (stickyQtyInput) {
    const onStickyQtyInput = () => {
      const normalizedQty = normalizeQty(stickyQtyInput.value);
      stickyQtyInput.value = normalizedQty;
      if (mainQtyInput) mainQtyInput.value = normalizedQty;
      updateStickyPrice();
    };

    stickyQtyInput.addEventListener('input', onStickyQtyInput);
    stickyQtyInput.addEventListener('change', onStickyQtyInput);
  }

  // Sticky bar is always visible - no need for scroll detection
  // Just ensure it's shown on page load
  if (stickyBar) {
    stickyBar.classList.add('visible');
  }

  // Handle sticky ATC button click
  if (stickyAddToCartBtn && productForm) {
    stickyAddToCartBtn.addEventListener('click', () => {
      // Sync quantity before submitting
      if (mainQtyInput && stickyQtyInput) {
        mainQtyInput.value = stickyQtyInput.value;
      }
      // Trigger the main form submission
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      productForm.dispatchEvent(submitEvent);
    });
  }

  // Sync main quantity changes to sticky
  if (mainQtyInput && stickyQtyInput) {
    const onMainQtyInput = () => {
      const normalizedQty = normalizeQty(mainQtyInput.value);
      mainQtyInput.value = normalizedQty;
      stickyQtyInput.value = normalizedQty;
      updateStickyPrice();
    };

    mainQtyInput.addEventListener('change', onMainQtyInput);
    mainQtyInput.addEventListener('input', onMainQtyInput);
  }

  document.addEventListener('sticky:offer-change', updateStickyPrice);
  document.addEventListener('sticky:variant-change', (event) => {
    const nextBasePrice = Number(event.detail?.variantPrice || 0);
    if (stickyPriceEl && Number.isFinite(nextBasePrice) && nextBasePrice > 0) {
      stickyPriceEl.dataset.basePrice = String(nextBasePrice);
      updateStickyPrice();
    }
  });

  updateStickyPrice();
}
