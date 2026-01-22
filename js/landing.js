// Pixel Fortress Landing Page JavaScript

'use strict'

// ============================================
// Mobile Navigation Toggle
// ============================================
function initMobileNav() {
  const navToggle = document.querySelector('.nav-toggle')
  const navLinks = document.querySelector('.nav-links')

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active')
      navToggle.classList.toggle('active')

      // Animate hamburger icon
      const spans = navToggle.querySelectorAll('span')
      if (navToggle.classList.contains('active')) {
        spans[0].style.transform = 'rotate(45deg) translateY(10px)'
        spans[1].style.opacity = '0'
        spans[2].style.transform = 'rotate(-45deg) translateY(-10px)'
      } else {
        spans[0].style.transform = 'none'
        spans[1].style.opacity = '1'
        spans[2].style.transform = 'none'
      }
    })

    // Close mobile menu when clicking a link
    const navLinkItems = navLinks.querySelectorAll('a')
    navLinkItems.forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active')
        navToggle.classList.remove('active')

        const spans = navToggle.querySelectorAll('span')
        spans[0].style.transform = 'none'
        spans[1].style.opacity = '1'
        spans[2].style.transform = 'none'
      })
    })

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('active')
        navToggle.classList.remove('active')

        const spans = navToggle.querySelectorAll('span')
        spans[0].style.transform = 'none'
        spans[1].style.opacity = '1'
        spans[2].style.transform = 'none'
      }
    })
  }
}

// ============================================
// FAQ Accordion
// ============================================
function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item')

  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question')

    if (question) {
      question.addEventListener('click', () => {
        // Close other FAQ items (optional - remove if you want multiple open at once)
        const wasActive = item.classList.contains('active')
        faqItems.forEach(otherItem => {
          otherItem.classList.remove('active')
        })

        // Toggle current item
        if (!wasActive) {
          item.classList.add('active')
        }
      })
    }
  })
}

// ============================================
// Smooth Scrolling
// ============================================
function initSmoothScroll() {
  const links = document.querySelectorAll('a[href^="#"]')

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href')

      // Only smooth scroll for internal hash links
      if (href && href !== '#' && href.startsWith('#')) {
        const targetId = href.substring(1)
        const targetElement = document.getElementById(targetId)

        if (targetElement) {
          e.preventDefault()

          // Get navbar height for offset
          const navbar = document.querySelector('.navbar')
          const navbarHeight = navbar ? navbar.offsetHeight : 0

          // Calculate position
          const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navbarHeight - 20

          // Smooth scroll
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          })
        }
      }
    })
  })
}

// ============================================
// Navbar Scroll Effects
// ============================================
function initNavbarScroll() {
  const navbar = document.querySelector('.navbar')

  if (navbar) {
    let lastScroll = 0

    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset

      // Add shadow when scrolled
      if (currentScroll > 50) {
        navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.7)'
      } else {
        navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5)'
      }

      lastScroll = currentScroll
    })
  }
}

// ============================================
// Scroll Reveal Animations
// ============================================
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.feature-card, .pricing-card, .opensource-card, .platform-card, .faq-item')

  const revealOnScroll = () => {
    const windowHeight = window.innerHeight
    const revealPoint = 100

    revealElements.forEach(element => {
      const elementTop = element.getBoundingClientRect().top

      if (elementTop < windowHeight - revealPoint) {
        element.style.opacity = '1'
        element.style.transform = 'translateY(0)'
      }
    })
  }

  // Set initial state
  revealElements.forEach(element => {
    element.style.opacity = '0'
    element.style.transform = 'translateY(30px)'
    element.style.transition = 'opacity 0.6s ease, transform 0.6s ease'
  })

  // Reveal on scroll
  window.addEventListener('scroll', revealOnScroll)
  revealOnScroll() // Initial check
}

// ============================================
// Hero Logo Animation
// ============================================
function initHeroAnimation() {
  const heroLogo = document.querySelector('.hero-logo')

  if (heroLogo) {
    // Add random floating particles effect (optional enhancement)
    const hero = document.querySelector('.hero')

    if (hero && window.innerWidth > 768) {
      // Create particle container
      const particleContainer = document.createElement('div')
      particleContainer.style.position = 'absolute'
      particleContainer.style.top = '0'
      particleContainer.style.left = '0'
      particleContainer.style.width = '100%'
      particleContainer.style.height = '100%'
      particleContainer.style.pointerEvents = 'none'
      particleContainer.style.overflow = 'hidden'
      hero.appendChild(particleContainer)

      // Create particles
      const particleCount = 20
      for (let i = 0; i < particleCount; i++) {
        createParticle(particleContainer)
      }
    }
  }
}

function createParticle(container) {
  const particle = document.createElement('div')
  particle.textContent = ['🌲', '⚔️', '🏰', '✨'][Math.floor(Math.random() * 4)]
  particle.style.position = 'absolute'
  particle.style.fontSize = Math.random() * 20 + 10 + 'px'
  particle.style.opacity = Math.random() * 0.3 + 0.1
  particle.style.left = Math.random() * 100 + '%'
  particle.style.top = Math.random() * 100 + '%'
  particle.style.filter = 'drop-shadow(0 0 5px rgba(255, 215, 0, 0.3))'

  container.appendChild(particle)

  // Animate particle
  const duration = Math.random() * 10 + 10
  const distance = Math.random() * 100 + 50

  particle.animate([
    { transform: 'translateY(0px) rotate(0deg)' },
    { transform: `translateY(-${distance}px) rotate(360deg)` }
  ], {
    duration: duration * 1000,
    iterations: Infinity,
    easing: 'ease-in-out'
  })
}

// ============================================
// Analytics Event Tracking (Optional)
// ============================================
function trackEvent(category, action, label) {
  // Placeholder for analytics tracking
  // You can integrate with Google Analytics, Plausible, etc.
  console.log('Event:', category, action, label)
}

function initAnalytics() {
  // Track CTA clicks
  const ctaButtons = document.querySelectorAll('.btn-primary, .btn-secondary, .btn-steam')
  ctaButtons.forEach(button => {
    button.addEventListener('click', () => {
      const text = button.textContent.trim()
      trackEvent('CTA', 'Click', text)
    })
  })

  // Track external links
  const externalLinks = document.querySelectorAll('a[target="_blank"]')
  externalLinks.forEach(link => {
    link.addEventListener('click', () => {
      const href = link.href
      trackEvent('External Link', 'Click', href)
    })
  })

  // Track scroll depth
  let maxScroll = 0
  const milestones = [25, 50, 75, 100]
  const reached = new Set()

  window.addEventListener('scroll', () => {
    const scrollPercent = (window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100

    milestones.forEach(milestone => {
      if (scrollPercent >= milestone && !reached.has(milestone)) {
        reached.add(milestone)
        trackEvent('Scroll Depth', 'Reached', `${milestone}%`)
      }
    })
  })
}

// ============================================
// Button Ripple Effect
// ============================================
function initButtonRipple() {
  const buttons = document.querySelectorAll('.btn')

  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span')
      const rect = this.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height)
      const x = e.clientX - rect.left - size / 2
      const y = e.clientY - rect.top - size / 2

      ripple.style.width = ripple.style.height = size + 'px'
      ripple.style.left = x + 'px'
      ripple.style.top = y + 'px'
      ripple.style.position = 'absolute'
      ripple.style.borderRadius = '50%'
      ripple.style.background = 'rgba(255, 255, 255, 0.3)'
      ripple.style.pointerEvents = 'none'
      ripple.style.transform = 'scale(0)'
      ripple.style.animation = 'ripple 0.6s ease-out'

      this.style.position = 'relative'
      this.style.overflow = 'hidden'
      this.appendChild(ripple)

      setTimeout(() => {
        ripple.remove()
      }, 600)
    })
  })

  // Add ripple animation to stylesheet dynamically
  if (!document.querySelector('#ripple-animation')) {
    const style = document.createElement('style')
    style.id = 'ripple-animation'
    style.textContent = `
      @keyframes ripple {
        to {
          transform: scale(2);
          opacity: 0;
        }
      }
    `
    document.head.appendChild(style)
  }
}

// ============================================
// Lazy Load Images (Future Enhancement)
// ============================================
function initLazyLoad() {
  if ('IntersectionObserver' in window) {
    const images = document.querySelectorAll('img[data-src]')

    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target
          img.src = img.dataset.src
          img.removeAttribute('data-src')
          observer.unobserve(img)
        }
      })
    })

    images.forEach(img => imageObserver.observe(img))
  }
}

// ============================================
// Initialize on Page Load
// ============================================
function init() {
  console.log('Pixel Fortress Landing Page - Initializing...')

  // Core functionality
  initMobileNav()
  initFAQ()
  initSmoothScroll()
  initNavbarScroll()

  // Visual enhancements
  initScrollReveal()
  initHeroAnimation()
  initButtonRipple()

  // Optional features
  initLazyLoad()
  initAnalytics()

  console.log('Pixel Fortress Landing Page - Ready!')
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

// Export functions for testing (optional)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initMobileNav,
    initFAQ,
    initSmoothScroll,
    initNavbarScroll,
    initScrollReveal,
    trackEvent
  }
}
