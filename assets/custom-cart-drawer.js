/**
 * Custom Cart Drawer JavaScript
 * Handles carousel navigation and add-to-cart functionality for recommendations
 */

class CustomCartDrawer {
  constructor() {
    // Singleton pattern - prevent multiple instances
    if (CustomCartDrawer.instance) {
      return CustomCartDrawer.instance;
    }
    CustomCartDrawer.instance = this;
    this.init();
  }

  init() {
    this.setupAddToCart();
  }

  /**
   * Setup add to cart functionality for recommendations
   */
  setupAddToCart() {
    // Use event delegation to handle dynamically loaded buttons
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('.custom-cart-recommendation__add-btn');
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const card = btn.closest('.custom-cart-recommendation');
      const variantSelect = card?.querySelector('.custom-cart-recommendation__variant-select');
      const variantId = variantSelect ? variantSelect.value : btn.dataset.variantId;

      if (variantId) {
        await this.addToCart(variantId, btn);
      }
    });

    // Handle variant selection change with event delegation
    document.addEventListener('change', (e) => {
      if (!e.target.classList.contains('custom-cart-recommendation__variant-select')) return;

      const variantId = e.target.value;
      const card = e.target.closest('.custom-cart-recommendation');
      const addBtn = card?.querySelector('.custom-cart-recommendation__add-btn');
      
      if (addBtn) {
        addBtn.dataset.variantId = variantId;
      }
    });
  }

  /**
   * Add item to cart
   * @param {string} variantId - The variant ID to add
   * @param {HTMLElement} button - The button element
   */
  async addToCart(variantId, button) {
    const originalText = button.textContent;
    const slide = button.closest('.swiper-slide');
    const card = button.closest('.custom-cart-recommendation');
    const isCombo = card?.dataset.isCombo === 'true';
    const comboComponentIds = card?.dataset.comboComponents;
    
    button.textContent = 'Adding...';
    button.disabled = true;

    try {
      // If this is a combo, remove component products first
      if (isCombo && comboComponentIds) {
        const componentIds = comboComponentIds.split(',').map(id => id.trim());
        await this.removeComboComponents(componentIds);
      }

      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{
            id: variantId,
            quantity: 1
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Add to cart failed:', errorData);
        throw new Error(errorData.description || 'Failed to add to cart');
      }

      // Update button state
      button.textContent = 'Added!';
      
      // Refresh only cart items and summary, not recommendations
      await this.refreshCartItemsOnly();
      
      // Remove the slide completely
      if (slide) {
        console.log('🔍 Removing slide from swiper');
        
        // Fade out animation
        slide.style.transition = 'opacity 0.3s ease';
        slide.style.opacity = '0';
        
        setTimeout(() => {
          // Remove the slide from DOM
          slide.remove();
          console.log('Slide removed from DOM');
          
          // Reinitialize swiper after slide removal
          if (typeof initCartRecommendationsSwiper === 'function') {
            console.log('Reinitializing swiper...');
            initCartRecommendationsSwiper();
          } else {
            console.error('❌ initCartRecommendationsSwiper function not found');
          }
        }, 300);
      }

    } catch (error) {
      console.error('Error adding to cart:', error);
      button.textContent = 'Error';
      
      // If combo removal succeeded, still refresh cart
      if (isCombo && comboComponentIds) {
        await this.refreshCartItemsOnly();
      }
      
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2000);
    }
  }

  /**
   * Refresh only cart items and summary, not recommendations
   */
  async refreshCartItemsOnly() {
    try {
      const cartItemsComponent = document.querySelector('cart-items-component');
      const sectionId = cartItemsComponent?.dataset.sectionId;
      
      if (!sectionId) return;
      
      const response = await fetch(`/?sections=${sectionId}`);
      const sections = await response.json();
      const sectionHtml = sections[sectionId];
      
      if (!sectionHtml) return;
      
      // Parse and update DOM
      const parser = new DOMParser();
      const doc = parser.parseFromString(sectionHtml, 'text/html');
      
      // Update only cart items (not recommendations)
      const newCartItems = doc.querySelector('.custom-cart-drawer__items');
      const currentCartItems = document.querySelector('.custom-cart-drawer__items');
      if (newCartItems && currentCartItems) {
        currentCartItems.innerHTML = newCartItems.innerHTML;
      }

      // Update cart summary
      const newCartSummary = doc.querySelector('.custom-cart-drawer__summary');
      const currentCartSummary = document.querySelector('.custom-cart-drawer__summary');
      if (newCartSummary && currentCartSummary) {
        currentCartSummary.innerHTML = newCartSummary.innerHTML;
      }

      // Update cart heading
      const newCartHeading = doc.querySelector('.custom-cart-drawer__heading');
      const currentCartHeading = document.querySelector('.custom-cart-drawer__heading');
      if (newCartHeading && currentCartHeading) {
        currentCartHeading.textContent = newCartHeading.textContent;
      }
      
      // Re-initialize components after DOM update
      setTimeout(() => {
        this.reinitializeComponents();
      }, 50);
    } catch (error) {
      console.error('Error refreshing cart items:', error);
    }
  }

  /**
   * Re-initialize Shopify components after DOM update
   */
  reinitializeComponents() {
    // Trigger updatedCallback for cart items component
    const cartItemsComponent = document.querySelector('cart-items-component');
    if (cartItemsComponent && typeof cartItemsComponent.updatedCallback === 'function') {
      cartItemsComponent.updatedCallback();
    }
    
    // Trigger updatedCallback for all quantity selectors
    const quantitySelectors = document.querySelectorAll('quantity-selector-component');
    quantitySelectors.forEach(selector => {
      if (typeof selector.updatedCallback === 'function') {
        selector.updatedCallback();
      }
    });
    
    // Also trigger for any other components that might be in the cart
    const allComponents = document.querySelectorAll('[class*="-component"]');
    allComponents.forEach(component => {
      if (component !== cartItemsComponent && 
          !Array.from(quantitySelectors).includes(component) &&
          typeof component.updatedCallback === 'function') {
        component.updatedCallback();
      }
    });

    // Reinitialize cart recommendations swiper
    if (typeof window.initCartRecommendationsSwiper === 'function') {
      setTimeout(window.initCartRecommendationsSwiper, 150);
    }
  }

  /**
   * Refresh cart drawer content
   */
  async refreshCartDrawer() {
    try {
      // Fetch the current page to get updated cart HTML
      const response = await fetch(window.location.pathname + '?section_id=custom-cart-drawer');
      const html = await response.text();
      
      // Parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Update cart items
      const newCartItems = doc.querySelector('.custom-cart-drawer__items');
      const currentCartItems = document.querySelector('.custom-cart-drawer__items');
      if (newCartItems && currentCartItems) {
        currentCartItems.innerHTML = newCartItems.innerHTML;
      }

      // Update cart summary
      const newCartSummary = doc.querySelector('.custom-cart-drawer__summary');
      const currentCartSummary = document.querySelector('.custom-cart-drawer__summary');
      if (newCartSummary && currentCartSummary) {
        currentCartSummary.innerHTML = newCartSummary.innerHTML;
      }

      // Update cart heading
      const newCartHeading = doc.querySelector('.custom-cart-drawer__heading');
      const currentCartHeading = document.querySelector('.custom-cart-drawer__heading');
      if (newCartHeading && currentCartHeading) {
        currentCartHeading.textContent = newCartHeading.textContent;
      }

      // Update recommendations
      const newRecommendations = doc.querySelector('.custom-cart-recommendations');
      const currentRecommendations = document.querySelector('.custom-cart-recommendations');
      if (newRecommendations && currentRecommendations) {
        currentRecommendations.innerHTML = newRecommendations.innerHTML;
      }

      // Re-initialize after update
      this.init();
      
    } catch (error) {
      console.error('Error refreshing cart drawer:', error);
    }
  }

  /**
   * Remove combo component products from cart
   * @param {Array<string>} productIds - Array of product IDs to remove
   */
  async removeComboComponents(productIds) {
    try {
      // Get current cart
      const cart = await fetch('/cart.js').then(r => r.json());
      
      // Build updates object using item keys
      const updates = {};
      
      cart.items.forEach((item) => {
        if (productIds.includes(item.product_id.toString())) {
          updates[item.key] = 0;
        }
      });
      
      if (Object.keys(updates).length === 0) {
        return;
      }
      
      // Apply updates using item keys
      const response = await fetch('/cart/update.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update cart');
      }
      
    } catch (error) {
      console.error('Error removing combo components:', error);
      throw error;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CustomCartDrawer();
  });
} else {
  new CustomCartDrawer();
}

// Re-initialize when cart drawer is opened
document.addEventListener('cart:opened', () => {
  new CustomCartDrawer();
});

// Global function to refresh cart drawer from anywhere
window.refreshCartDrawer = async function() {
  try {
    const cartItemsComponent = document.querySelector('cart-items-component');
    const sectionId = cartItemsComponent?.dataset.sectionId;
    
    if (!sectionId) {
      console.error('Cart section ID not found');
      return;
    }
    
    // Ensure the component is fully initialized first
    // Wait for it to be connected if it's not already
    if (cartItemsComponent && !cartItemsComponent.isConnected) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Check if component has been initialized (has refs)
    const needsInitialization = !cartItemsComponent.refs || Object.keys(cartItemsComponent.refs).length === 0;
    
    if (needsInitialization) {
      // Component not initialized yet, wait for it
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Fetch updated section HTML
    const response = await fetch(`/?sections=${sectionId}`);
    const sections = await response.json();
    const sectionHtml = sections[sectionId];
    
    if (!sectionHtml) {
      console.error('Section HTML not found');
      return;
    }
    
    // Parse the new HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(sectionHtml, 'text/html');
    const newComponent = doc.querySelector('cart-items-component');
    
    if (!newComponent || !cartItemsComponent) return;
    
    // Replace innerHTML
    cartItemsComponent.innerHTML = newComponent.innerHTML;
    
    // Wait for DOM to settle
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Trigger updatedCallback to re-initialize refs and event listeners
    if (typeof cartItemsComponent.updatedCallback === 'function') {
      cartItemsComponent.updatedCallback();
    }
    
    // Re-initialize CustomCartDrawer for recommendations
    setTimeout(() => {
      new CustomCartDrawer();
      
      if (typeof initCartRecommendationsSwiper === 'function') {
        initCartRecommendationsSwiper();
      }
    }, 100);
    
  } catch (error) {
    console.error('Error refreshing cart:', error);
  }
};

// New function to refresh cart content and re-attach event listeners
window.refreshCartContent = async function() {
  try {
    const cartItemsComponent = document.querySelector('cart-items-component');
    const sectionId = cartItemsComponent?.dataset.sectionId;
    
    if (!sectionId) {
      console.error('Cart section ID not found');
      return;
    }
    
    // Fetch updated section HTML
    const response = await fetch(`/?sections=${sectionId}`);
    const sections = await response.json();
    const sectionHtml = sections[sectionId];
    
    if (!sectionHtml) {
      console.error('Section HTML not found');
      return;
    }
    
    // Parse the new HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(sectionHtml, 'text/html');
    const newCartItemsComponent = doc.querySelector('cart-items-component');
    
    if (!newCartItemsComponent || !cartItemsComponent) {
      console.error('Cart items component not found');
      return;
    }
    
    // Replace the entire cart-items-component innerHTML
    cartItemsComponent.innerHTML = newCartItemsComponent.innerHTML;
    
    // Wait for DOM to settle
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if the custom element is defined
    const isCartItemsDefined = customElements.get('cart-items-component');
    
    if (!isCartItemsDefined) {
      // Dynamically load the component script if not loaded
      try {
        const scriptUrl = document.querySelector('script[src*="component-cart-items"]')?.src;
        if (scriptUrl) {
          await import(scriptUrl);
          await customElements.whenDefined('cart-items-component');
        }
      } catch (error) {
        console.error('Error loading component script:', error);
      }
      
      // Force upgrade the element
      customElements.upgrade(cartItemsComponent);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Trigger updatedCallback to re-initialize refs and event listeners
    if (typeof cartItemsComponent.updatedCallback === 'function') {
      cartItemsComponent.updatedCallback();
    } else if (typeof cartItemsComponent.connectedCallback === 'function') {
      cartItemsComponent.connectedCallback();
    }
    
    // Also manually trigger connectedCallback on all quantity selector components
    const quantitySelectors = cartItemsComponent.querySelectorAll('quantity-selector-component');
    quantitySelectors.forEach((selector) => {
      if (typeof selector.connectedCallback === 'function' && selector.isConnected) {
        selector.connectedCallback();
      }
    });
    
    // Re-initialize CustomCartDrawer for recommendations
    setTimeout(() => {
      if (typeof CustomCartDrawer !== 'undefined') {
        new CustomCartDrawer();
      }
      
      if (typeof initCartRecommendationsSwiper === 'function') {
        initCartRecommendationsSwiper();
      }
    }, 150);
    
  } catch (error) {
    console.error('Error refreshing cart:', error);
  }
};

export default CustomCartDrawer;
