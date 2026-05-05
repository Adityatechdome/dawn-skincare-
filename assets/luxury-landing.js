// ============================================
// LUXURY LANDING PAGE - INTERACTIVE ELEMENTS
// ============================================

// PARTICLE ANIMATION FOR HERO SECTION
function initParticles() {
  const heroParticles = document.querySelector('.hero-particles');

  if (!heroParticles) return;

  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.cssText = `
      position: absolute;
      width: ${Math.random() * 10 + 5}px;
      height: ${Math.random() * 10 + 5}px;
      background: rgba(217, 186, 130, ${Math.random() * 0.5 + 0.3});
      border-radius: 50%;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation: float ${Math.random() * 4 + 3}s ease-in-out infinite;
      animation-delay: ${Math.random() * 2}s;
    `;
    heroParticles.appendChild(particle);
  }
}

// NAVIGATION SCROLL EFFECT
function initNavScroll() {
  const nav = document.querySelector('.luxury-nav');

  if (!nav) return;

  window.addEventListener('scroll', function() {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });
}

// STICKY CTA SCROLL TRIGGER
function initStickyCTA() {
  const stickyCTA = document.getElementById('sticky-cta');

  if (!stickyCTA) return;

  window.addEventListener('scroll', function() {
    const scrollPercentage = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;

    if (scrollPercentage > 50 && !sessionStorage.getItem('stickyCTAClosed')) {
      stickyCTA.classList.add('visible');
    }
  });
}

// CLOSE STICKY CTA
window.closeStickyCTA = function() {
  const stickyCTA = document.getElementById('sticky-cta');
  if (stickyCTA) {
    stickyCTA.classList.remove('visible');
    sessionStorage.setItem('stickyCTAClosed', 'true');
  }
}

// TESTIMONIALS CAROUSEL
let currentTestimonial = 0;

window.nextTestimonial = function() {
  const carousel = document.getElementById('testimonials-carousel');
  const testimonials = document.querySelectorAll('.testimonial-card');

  if (!carousel || !testimonials.length) return;

  currentTestimonial = (currentTestimonial + 1) % testimonials.length;
  carousel.style.transform = `translateX(-${currentTestimonial * 100}%)`;
}

window.prevTestimonial = function() {
  const carousel = document.getElementById('testimonials-carousel');
  const testimonials = document.querySelectorAll('.testimonial-card');

  if (!carousel || !testimonials.length) return;

  currentTestimonial = (currentTestimonial - 1 + testimonials.length) % testimonials.length;
  carousel.style.transform = `translateX(-${currentTestimonial * 100}%)`;
}

// SCROLL REVEAL ANIMATIONS
function initScrollReveal() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'fadeIn 0.8s ease-out forwards';
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all cards and sections
  document.querySelectorAll(
    '.product-card, .benefit-card, .testimonial-card, .story-content'
  ).forEach(el => {
    observer.observe(el);
  });
}

// SMOOTH SCROLL FOR LINKS
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');

      if (href === '#') return;

      const target = document.querySelector(href);

      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// INITIALIZE ALL ON DOCUMENT LOAD
document.addEventListener('DOMContentLoaded', function() {
  initParticles();
  initNavScroll();
  initStickyCTA();
  initScrollReveal();
  initSmoothScroll();
});

// REINITIALIZE ON PAGE VISIBLE (for single-page navigation)
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    initParticles();
    initScrollReveal();
  }
});
