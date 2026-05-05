import { DialogComponent } from '@theme/dialog';
import { CartAddEvent } from '@theme/events';

/**
 * A custom element that manages a cart drawer.
 *
 * @extends {DialogComponent}
 */
class CartDrawerComponent extends DialogComponent {
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener(CartAddEvent.eventName, this.#handleCartAdd);
    
    // Listen for dialog close event to remove scroll-lock
    this.addEventListener('dialog:close', this.#handleDialogClose);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener(CartAddEvent.eventName, this.#handleCartAdd);
    this.removeEventListener('dialog:close', this.#handleDialogClose);
  }

  #handleCartAdd = () => {
    if (this.hasAttribute('auto-open')) {
      this.showDialog();
    }
  };

  #handleDialogClose = () => {
    // Remove scroll-lock whenever dialog closes
    document.documentElement.removeAttribute('scroll-lock');
  };

  open() {
    this.showDialog();

    // Add scroll-lock to html element
    document.documentElement.setAttribute('scroll-lock', '');

    // Dispatch cart:opened event for other components to listen
    document.dispatchEvent(new CustomEvent('cart:opened', { 
      bubbles: true,
      detail: { drawer: this }
    }));

    /**
     * Close cart drawer when installments CTA is clicked to avoid overlapping dialogs
     */
    customElements.whenDefined('shopify-payment-terms').then(() => {
      const installmentsContent = document.querySelector('shopify-payment-terms')?.shadowRoot;
      const cta = installmentsContent?.querySelector('#shopify-installments-cta');
      cta?.addEventListener('click', this.close, { once: true });
    });
  }

  close() {
    // Remove scroll-lock from html element
    document.documentElement.removeAttribute('scroll-lock');
    this.closeDialog();
  }
}

if (!customElements.get('cart-drawer-component')) {
  customElements.define('cart-drawer-component', CartDrawerComponent);
}
