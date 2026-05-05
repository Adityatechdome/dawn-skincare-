import { Component } from '@theme/component';
import { fetchConfig, debounce, onAnimationEnd, prefersReducedMotion, resetShimmer } from '@theme/utilities';
import { morphSection, sectionRenderer } from '@theme/section-renderer';
import {
  ThemeEvents,
  CartUpdateEvent,
  QuantitySelectorUpdateEvent,
  CartAddEvent,
  DiscountUpdateEvent,
} from '@theme/events';
import { cartPerformance } from '@theme/performance';

/** @typedef {import('./utilities').TextComponent} TextComponent */

/**
 * A custom element that displays a cart items component.
 *
 * @typedef {object} Refs
 * @property {HTMLElement[]} quantitySelectors - The quantity selector elements.
 * @property {HTMLTableRowElement[]} cartItemRows - The cart item rows.
 * @property {TextComponent} cartTotal - The cart total.
 *
 * @extends {Component<Refs>}
 */
class CartItemsComponent extends Component {
  #debouncedOnChange = debounce(this.#onQuantityChange, 300).bind(this);

  connectedCallback() {
    super.connectedCallback();

    document.addEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate);
    document.addEventListener(ThemeEvents.discountUpdate, this.handleDiscountUpdate);
    document.addEventListener(ThemeEvents.quantitySelectorUpdate, this.#debouncedOnChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    document.removeEventListener(ThemeEvents.cartUpdate, this.#handleCartUpdate);
    document.removeEventListener(ThemeEvents.quantitySelectorUpdate, this.#debouncedOnChange);
  }

  /**
   * Handles QuantitySelectorUpdateEvent change event.
   * @param {QuantitySelectorUpdateEvent} event - The event.
   */
  #onQuantityChange(event) {
    const { quantity, cartLine: line } = event.detail;

    if (!line) return;

    if (quantity === 0) {
      return this.onLineItemRemove(line);
    }

    this.updateQuantity({
      line,
      quantity,
      action: 'change',
    });
    const lineItemRow = this.refs.cartItemRows[line - 1];

    if (!lineItemRow) return;

    const textComponent = /** @type {TextComponent | undefined} */ (lineItemRow.querySelector('text-component'));
    textComponent?.shimmer();
  }

  /**
   * Handles the line item removal.
   * @param {number} line - The line item index.
   */
  onLineItemRemove(line) {
    this.updateQuantity({
      line,
      quantity: 0,
      action: 'clear',
    });

    const cartItemRowToRemove = this.refs.cartItemRows[line - 1];

    if (!cartItemRowToRemove) return;

    const rowsToRemove = [
      cartItemRowToRemove,
      // Get all nested lines of the row to remove
      ...this.refs.cartItemRows.filter((row) => row.dataset.parentKey === cartItemRowToRemove.dataset.key),
    ];

    // Add class to the row to trigger the animation
    rowsToRemove.forEach((row) => {
      const remove = () => row.remove();

      if (prefersReducedMotion()) return remove();

      row.style.setProperty('--row-height', `${row.clientHeight}px`);
      row.classList.add('removing');

      // Remove the row after the animation ends
      onAnimationEnd(row, remove);
    });
  }

  /**
   * Updates the quantity.
   * @param {Object} config - The config.
   * @param {number} config.line - The line.
   * @param {number} config.quantity - The quantity.
   * @param {string} config.action - The action.
   */
  updateQuantity(config) {
    const cartPerformaceUpdateMarker = cartPerformance.createStartingMarker(`${config.action}:user-action`);

    this.#disableCartItems();

    const { line, quantity } = config;
    const { cartTotal } = this.refs;

    const cartItemsComponents = document.querySelectorAll('cart-items-component');
    const sectionsToUpdate = new Set([this.sectionId]);
    cartItemsComponents.forEach((item) => {
      if (item instanceof HTMLElement && item.dataset.sectionId) {
        sectionsToUpdate.add(item.dataset.sectionId);
      }
    });

    const body = JSON.stringify({
      line: line,
      quantity: quantity,
      sections: Array.from(sectionsToUpdate).join(','),
      sections_url: window.location.pathname,
    });

    cartTotal?.shimmer();

    fetch(`${Theme.routes.cart_change_url}`, fetchConfig('json', { body }))
      .then((response) => {
        return response.text();
      })
      .then((responseText) => {
        const parsedResponseText = JSON.parse(responseText);

        resetShimmer(this);

        if (parsedResponseText.errors) {
          this.#handleCartError(line, parsedResponseText);
          return;
        }

        const newSectionHTML = new DOMParser().parseFromString(
          parsedResponseText.sections[this.sectionId],
          'text/html'
        );

        // Grab the new cart item count from a hidden element
        const newCartHiddenItemCount = newSectionHTML.querySelector('[ref="cartItemCount"]')?.textContent;
        const newCartItemCount = newCartHiddenItemCount ? parseInt(newCartHiddenItemCount, 10) : 0;

        this.dispatchEvent(
          new CartUpdateEvent({}, this.sectionId, {
            itemCount: newCartItemCount,
            source: 'cart-items-component',
            sections: parsedResponseText.sections,
          })
        );

        morphSection(this.sectionId, parsedResponseText.sections[this.sectionId]);

        // Reinitialize swiper after cart update
        this.#reinitializeSwiper();

        // Check if we should remove the Off10 discount
        if (quantity === 0) {
          this.#checkAndRemoveBogoDiscount();
        }
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        this.#enableCartItems();
        cartPerformance.measureFromMarker(cartPerformaceUpdateMarker);
      });
  }

  /**
   * Checks if there are any BOGO items in cart, and removes their discount codes if not
   */
  async #checkAndRemoveBogoDiscount() {
    try {
      // Get current cart
      const cartResponse = await fetch('/cart.js');
      const cart = await cartResponse.json();

      // Get all discount codes that should be in cart (from BOGO items)
      const bogoDiscountCodes = new Set();
      cart.items.forEach(item => {
        if (item.properties && item.properties._offer_type === 'bogo' && item.properties._discount_code) {
          bogoDiscountCodes.add(item.properties._discount_code);
        }
      });

      // Get currently applied discount codes
      const appliedDiscounts = cart.discount_codes || [];
      
      // Find discount codes that should be removed (applied but no matching BOGO item)
      const discountsToRemove = appliedDiscounts.filter(discount => {
        const code = discount.code;
        // Remove if it's a BOGO discount (starts with 'Off10') and not in the bogoDiscountCodes set
        return code.startsWith('Off10') && !bogoDiscountCodes.has(code);
      });

      // If there are discounts to remove, update the cart
      if (discountsToRemove.length > 0) {
        // Keep only the discount codes that should remain
        const remainingDiscounts = appliedDiscounts
          .filter(discount => !discountsToRemove.some(d => d.code === discount.code))
          .map(discount => discount.code)
          .join(',');

        await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            discount: remainingDiscounts // Empty string removes all discounts
          })
        });

        // Refresh the cart to show updated prices
        if (typeof window.refreshCartDrawer === 'function') {
          await window.refreshCartDrawer();
        }
      }
    } catch (error) {
      console.error('Error checking BOGO discount:', error);
    }
  }

  /**
   * Handles the discount update.
   * @param {DiscountUpdateEvent} event - The event.
   */
  handleDiscountUpdate = (event) => {
    this.#handleCartUpdate(event);
  };

  /**
   * Handles the cart error.
   * @param {number} line - The line.
   * @param {Object} parsedResponseText - The parsed response text.
   * @param {string} parsedResponseText.errors - The errors.
   */
  #handleCartError = (line, parsedResponseText) => {
    const quantitySelector = this.refs.quantitySelectors[line - 1];
    const quantityInput = quantitySelector?.querySelector('input');

    if (!quantityInput) throw new Error('Quantity input not found');

    quantityInput.value = quantityInput.defaultValue;

    const cartItemError = this.refs[`cartItemError-${line}`];
    const cartItemErrorContainer = this.refs[`cartItemErrorContainer-${line}`];

    if (!(cartItemError instanceof HTMLElement)) throw new Error('Cart item error not found');
    if (!(cartItemErrorContainer instanceof HTMLElement)) throw new Error('Cart item error container not found');

    cartItemError.textContent = parsedResponseText.errors;
    cartItemErrorContainer.classList.remove('hidden');
  };

  /**
   * Handles the cart update.
   *
   * @param {DiscountUpdateEvent | CartUpdateEvent | CartAddEvent} event
   */
  #handleCartUpdate = (event) => {
    console.log('🛒 cart-items-component received cart update event');
    console.log('Event detail:', event.detail);
    console.log('Event target:', event.target);
    console.log('This component:', this);
    console.log('This section ID:', this.sectionId);
    
    if (event instanceof DiscountUpdateEvent) {
      console.log('Handling as DiscountUpdateEvent');
      sectionRenderer.renderSection(this.sectionId, { cache: false });
      this.#reinitializeSwiper();
      return;
    }
    if (event.target === this) {
      console.log('Event target is this component, ignoring');
      return;
    }

    const cartItemsHtml = event.detail.data.sections?.[this.sectionId];
    console.log('Cart items HTML found:', !!cartItemsHtml);
    console.log('Available sections:', Object.keys(event.detail.data.sections || {}));
    
    if (cartItemsHtml) {
      console.log('Morphing section with new HTML');
      morphSection(this.sectionId, cartItemsHtml);
      this.#reinitializeSwiper();
    } else {
      console.log('No HTML found, rendering section from server');
      sectionRenderer.renderSection(this.sectionId, { cache: false });
      this.#reinitializeSwiper();
    }
  };

  /**
   * Reinitializes the cart recommendations swiper after cart updates
   */
  #reinitializeSwiper() {
    // Wait for DOM to update and cart drawer to render before reinitializing swiper
    setTimeout(() => {
      if (typeof window.initCartRecommendationsSwiper === 'function') {
        console.log('🔄 Reinitializing cart recommendations swiper...');
        window.initCartRecommendationsSwiper();
      } else {
        console.warn('⚠️ initCartRecommendationsSwiper function not found');
      }
    }, 500); // Increased timeout to ensure DOM is fully updated
  }

  /**
   * Disables the cart items.
   */
  #disableCartItems() {
    this.classList.add('cart-items-disabled');
  }

  /**
   * Enables the cart items.
   */
  #enableCartItems() {
    this.classList.remove('cart-items-disabled');
  }

  /**
   * Gets the section id.
   * @returns {string} The section id.
   */
  get sectionId() {
    const { sectionId } = this.dataset;

    if (!sectionId) throw new Error('Section id missing');

    return sectionId;
  }
}

if (!customElements.get('cart-items-component')) {
  customElements.define('cart-items-component', CartItemsComponent);
}
