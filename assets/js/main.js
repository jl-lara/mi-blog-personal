// ===== CONFIGURACIÓN GLOBAL =====
const CONFIG = {
  POSTS_FILE: "data/posts.json",
  MAX_EXCERPT_LENGTH: 150,
  DATE_FORMAT_OPTIONS: {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
  READING_SPEED: 200, // palabras por minuto
}

// ===== ESTADO GLOBAL DE LA APLICACIÓN =====
const appState = {
  posts: [],
  currentPost: null,
  isLoading: false,
  error: null,
  editingPostId: null,
  mobileMenuOpen: false,
}

// ===== UTILIDADES =====
const utils = {
  // Formatear fecha
  formatDate: (dateString) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        throw new Error("Fecha inválida")
      }
      return date.toLocaleDateString("es-ES", CONFIG.DATE_FORMAT_OPTIONS)
    } catch (error) {
      console.error("Error al formatear fecha:", error)
      return "Fecha no válida"
    }
  },

  // Crear excerpt del contenido
  createExcerpt: (content, maxLength = CONFIG.MAX_EXCERPT_LENGTH) => {
    if (!content || typeof content !== "string") return ""

    const cleanContent = content.replace(/<[^>]*>/g, "").trim()
    if (cleanContent.length <= maxLength) return cleanContent

    return cleanContent.substring(0, maxLength).trim() + "..."
  },

  // Calcular tiempo de lectura
  calculateReadingTime: (content) => {
    if (!content || typeof content !== "string") return "5 min"

    const wordCount = content.trim().split(/\s+/).length
    const readingTime = Math.ceil(wordCount / CONFIG.READING_SPEED)

    return `${readingTime} min de lectura`
  },

  // Obtener parámetro de URL
  getUrlParameter: (name) => {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.get(name)
  },

  // Generar ID único
  generateId: () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  },

  // Validar estructura de post
  validatePost: (post) => {
    const errors = []

    if (!post.id || typeof post.id !== "string") {
      errors.push("ID es requerido y debe ser string")
    }

    if (!post.title || typeof post.title !== "string" || post.title.trim().length === 0) {
      errors.push("Título es requerido y no puede estar vacío")
    }

    if (!post.date || typeof post.date !== "string") {
      errors.push("Fecha es requerida y debe ser string")
    } else {
      const date = new Date(post.date)
      if (isNaN(date.getTime())) {
        errors.push("Fecha debe tener formato válido (YYYY-MM-DD)")
      }
    }

    if (!post.content || typeof post.content !== "string" || post.content.trim().length === 0) {
      errors.push("Contenido es requerido y no puede estar vacío")
    }

    // Validaciones opcionales
    if (post.image && typeof post.image !== "string") {
      errors.push("Imagen debe ser una URL válida")
    }

    if (post.excerpt && typeof post.excerpt !== "string") {
      errors.push("Excerpt debe ser string")
    }

    return errors
  },

  // Validar JSON completo
  validatePostsJson: (jsonString) => {
    try {
      const data = JSON.parse(jsonString)

      if (!Array.isArray(data)) {
        return { valid: false, error: "El JSON debe ser un array" }
      }

      const allErrors = []
      data.forEach((post, index) => {
        const errors = utils.validatePost(post)
        if (errors.length > 0) {
          allErrors.push(`Post ${index + 1}: ${errors.join(", ")}`)
        }
      })

      if (allErrors.length > 0) {
        return { valid: false, error: allErrors.join("\n") }
      }

      return { valid: true, data }
    } catch (error) {
      return { valid: false, error: `JSON inválido: ${error.message}` }
    }
  },

  // Procesar contenido Markdown básico
  processMarkdown: (content) => {
    if (!content || typeof content !== "string") return ""

    return (
      content
        // Párrafos
        .split("\n\n")
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph.length > 0)
        .map((paragraph) => {
          // Títulos
          if (paragraph.startsWith("## ")) {
            return `<h2>${paragraph.substring(3)}</h2>`
          }
          if (paragraph.startsWith("### ")) {
            return `<h3>${paragraph.substring(4)}</h3>`
          }
          if (paragraph.startsWith("#### ")) {
            return `<h4>${paragraph.substring(5)}</h4>`
          }

          // Listas
          if (paragraph.includes("\n• ") || paragraph.includes("\n- ")) {
            const items = paragraph
              .split(/\n[•-] /)
              .filter((item) => item.trim())
              .map((item) => `<li>${utils.escapeHtml(item.trim())}</li>`)
              .join("")
            return `<ul>${items}</ul>`
          }

          // Párrafo normal con formato
          const processedParagraph = paragraph
            // Negrita
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            // Cursiva
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            // Código inline
            .replace(/`(.*?)`/g, "<code>$1</code>")
            // Saltos de línea
            .replace(/\n/g, "<br>")

          return `<p>${utils.escapeHtml(processedParagraph)}</p>`
        })
        .join("")
    )
  },

  // Escapar HTML
  escapeHtml: (text) => {
    if (typeof text !== "string") return ""

    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  },

  // Mostrar notificación
  showNotification: (message, type = "info") => {
    // Crear elemento de notificación
    const notification = document.createElement("div")
    notification.className = `notification notification-${type}`

    const icon =
      {
        info: "ℹ️",
        success: "✅",
        error: "❌",
        warning: "⚠️",
      }[type] || "ℹ️"

    notification.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${message}</span>
      <button onclick="this.parentElement.remove()" aria-label="Cerrar notificación" class="notification-close">×</button>
    `

    // Añadir estilos si no existen
    if (!document.getElementById("notification-styles")) {
      const styles = document.createElement("style")
      styles.id = "notification-styles"
      styles.textContent = `
        .notification {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          color: white;
          font-weight: 500;
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          max-width: 400px;
          box-shadow: 0 8px 24px rgba(45, 27, 20, 0.2);
          animation: slideInRight 0.3s ease;
          font-family: var(--font-secondary);
        }
        .notification-info { background: linear-gradient(135deg, #2196f3, #1976d2); }
        .notification-success { background: linear-gradient(135deg, #4caf50, #388e3c); }
        .notification-error { background: linear-gradient(135deg, #f44336, #d32f2f); }
        .notification-warning { background: linear-gradient(135deg, #ff9800, #f57c00); }
        .notification-icon { font-size: 1.25rem; }
        .notification-message { flex: 1; }
        .notification-close {
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background-color 0.2s ease;
        }
        .notification-close:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `
      document.head.appendChild(styles)
    }

    document.body.appendChild(notification)

    // Auto-remover después de 5 segundos
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = "slideInRight 0.3s ease reverse"
        setTimeout(() => notification.remove(), 300)
      }
    }, 5000)
  },
}

// ===== API PARA MANEJAR POSTS =====
const postsAPI = {
  // Cargar posts desde JSON
  load: async () => {
    try {
      appState.isLoading = true
      appState.error = null

      const response = await fetch(CONFIG.POSTS_FILE)

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`)
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("La respuesta no es JSON válido")
      }

      const posts = await response.json()

      if (!Array.isArray(posts)) {
        throw new Error("Los datos deben ser un array de posts")
      }

      // Validar cada post
      const validationErrors = []
      posts.forEach((post, index) => {
        const errors = utils.validatePost(post)
        if (errors.length > 0) {
          validationErrors.push(`Post ${index + 1}: ${errors.join(", ")}`)
        }
      })

      if (validationErrors.length > 0) {
        throw new Error(`Errores de validación:\n${validationErrors.join("\n")}`)
      }

      // Ordenar posts por fecha (más reciente primero)
      posts.sort((a, b) => new Date(b.date) - new Date(a.date))

      appState.posts = posts
      appState.isLoading = false

      return posts
    } catch (error) {
      appState.isLoading = false
      appState.error = error.message
      console.error("Error cargando posts:", error)
      throw error
    }
  },

  // Obtener post por ID
  getById: (id) => {
    return appState.posts.find((post) => post.id === id) || null
  },

  // Simular guardado
  save: async (posts) => {
    try {
      // Validar datos antes de "guardar"
      const validation = utils.validatePostsJson(JSON.stringify(posts))
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      // Simular delay de red
      await new Promise((resolve) => setTimeout(resolve, 800))

      // En una aplicación real, aquí harías la llamada al servidor
      console.log("Posts guardados:", posts)

      // Actualizar estado local
      appState.posts = posts.sort((a, b) => new Date(b.date) - new Date(a.date))

      return true
    } catch (error) {
      console.error("Error guardando posts:", error)
      throw error
    }
  },
}

// ===== FUNCIONES DE NAVEGACIÓN =====
function toggleMobileMenu() {
  const navMenu = document.querySelector(".nav-menu")
  const mobileBtn = document.querySelector(".mobile-menu-btn")

  appState.mobileMenuOpen = !appState.mobileMenuOpen

  if (appState.mobileMenuOpen) {
    navMenu.classList.add("active")
    mobileBtn.classList.add("active")
  } else {
    navMenu.classList.remove("active")
    mobileBtn.classList.remove("active")
  }
}

// Cerrar menú móvil al hacer clic en un enlace
document.addEventListener("click", (e) => {
  if (e.target.matches(".nav-link") && appState.mobileMenuOpen) {
    toggleMobileMenu()
  }
})

// ===== FUNCIONES PARA LA PÁGINA PRINCIPAL =====
const homePage = {
  init: () => {
    if (document.getElementById("posts-container")) {
      loadPosts()
      setupSmoothScrolling()
    }
  },
}

function setupSmoothScrolling() {
  // Smooth scroll para enlaces internos
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault()
      const target = document.querySelector(this.getAttribute("href"))
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }
    })
  })
}

// Cargar y mostrar posts en la página principal
async function loadPosts() {
  const loadingEl = document.getElementById("loading")
  const errorEl = document.getElementById("error-message")
  const postsContainer = document.getElementById("posts-container")
  const noPostsEl = document.getElementById("no-posts")

  // Mostrar loading
  if (loadingEl) loadingEl.style.display = "block"
  if (errorEl) errorEl.style.display = "none"
  if (postsContainer) postsContainer.style.display = "none"
  if (noPostsEl) noPostsEl.style.display = "none"

  try {
    const posts = await postsAPI.load()

    if (loadingEl) loadingEl.style.display = "none"

    if (posts.length === 0) {
      if (noPostsEl) noPostsEl.style.display = "block"
      return
    }

    if (postsContainer) {
      postsContainer.innerHTML = posts
        .map((post, index) => {
          const defaultImage =
            "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&h=250&fit=crop&crop=center"
          const postImage = post.image || defaultImage
          const excerpt = post.excerpt || utils.createExcerpt(post.content)

          return `
            <article class="post-card" style="animation-delay: ${index * 0.1}s">
              <div class="post-card-image">
                <img src="${postImage}" alt="${utils.escapeHtml(post.title)}" loading="lazy" onerror="this.src='${defaultImage}'">
                <div class="post-card-overlay"></div>
              </div>
              <div class="post-card-content">
                <h3 class="post-card-title">
                  <a href="post.html?id=${encodeURIComponent(post.id)}">${utils.escapeHtml(post.title)}</a>
                </h3>
                <div class="post-card-meta">
                  <div class="post-card-date">
                    <span>📅</span>
                    <time datetime="${post.date}">${utils.formatDate(post.date)}</time>
                  </div>
                  <div class="reading-time">
                    <span>⏱️</span>
                    <span>${utils.calculateReadingTime(post.content)}</span>
                  </div>
                </div>
                <p class="post-card-excerpt">${utils.escapeHtml(excerpt)}</p>
                <a href="post.html?id=${encodeURIComponent(post.id)}" class="read-more">
                  Leer historia completa →
                </a>
              </div>
            </article>
          `
        })
        .join("")

      postsContainer.style.display = "grid"
    }
  } catch (error) {
    if (loadingEl) loadingEl.style.display = "none"

    if (errorEl) {
      const errorDetails = document.getElementById("error-details")
      if (errorDetails) {
        errorDetails.textContent = error.message
      }
      errorEl.style.display = "block"
    }
  }
}

// ===== FUNCIONES PARA LA PÁGINA DE POST INDIVIDUAL =====
const postPage = {
  init: () => {
    if (document.getElementById("post-content")) {
      loadPost()
    }
  },
}

// Cargar y mostrar post individual
async function loadPost() {
  const postId = utils.getUrlParameter("id")
  const loadingEl = document.getElementById("loading")
  const errorEl = document.getElementById("error-message")
  const postContent = document.getElementById("post-content")

  // Mostrar loading
  if (loadingEl) loadingEl.style.display = "block"
  if (errorEl) errorEl.style.display = "none"
  if (postContent) postContent.style.display = "none"

  if (!postId) {
    showPostError("No se especificó el ID del post")
    return
  }

  try {
    await postsAPI.load()
    const post = postsAPI.getById(postId)

    if (loadingEl) loadingEl.style.display = "none"

    if (!post) {
      showPostError(`No se encontró la historia con ID: ${postId}`)
      return
    }

    // Actualizar título de la página
    document.title = `${post.title} - Café & Pasión`

    // Mostrar contenido del post
    if (postContent) {
      const titleEl = document.getElementById("article-title")
      const dateEl = document.getElementById("article-date")
      const contentEl = document.getElementById("article-content")
      const featuredImageEl = document.getElementById("post-featured-image")
      const readingTimeEl = document.getElementById("reading-time")

      if (titleEl) titleEl.textContent = post.title

      if (dateEl) {
        dateEl.textContent = utils.formatDate(post.date)
        dateEl.setAttribute("datetime", post.date)
      }

      if (readingTimeEl) {
        readingTimeEl.textContent = utils.calculateReadingTime(post.content)
      }

      if (featuredImageEl) {
        const defaultImage =
          "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=1200&h=600&fit=crop&crop=center"
        featuredImageEl.src = post.image || defaultImage
        featuredImageEl.alt = post.title
        featuredImageEl.onerror = function () {
          this.src = defaultImage
        }
      }

      if (contentEl) {
        contentEl.innerHTML = utils.processMarkdown(post.content)
      }

      postContent.style.display = "block"
    }

    appState.currentPost = post
  } catch (error) {
    if (loadingEl) loadingEl.style.display = "none"
    showPostError(`Error cargando la historia: ${error.message}`)
  }
}

// Mostrar error en página de post
function showPostError(message) {
  const errorEl = document.getElementById("error-message")
  const errorDetails = document.getElementById("error-details")

  if (errorEl && errorDetails) {
    errorDetails.textContent = message
    errorEl.style.display = "block"
  }
}

// Funciones para compartir post
function sharePost(platform) {
  if (!appState.currentPost) return

  const url = window.location.href
  const title = appState.currentPost.title
  const text = `¡Echa un vistazo a esta historia sobre café: "${title}"`

  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`,
  }

  if (shareUrls[platform]) {
    window.open(shareUrls[platform], "_blank", "width=600,height=400")
  }
}

function copyLink() {
  navigator.clipboard
    .writeText(window.location.href)
    .then(() => {
      utils.showNotification("Enlace copiado al portapapeles", "success")
    })
    .catch(() => {
      utils.showNotification("No se pudo copiar el enlace", "error")
    })
}

// ===== FUNCIONES PARA EL PANEL DE ADMINISTRACIÓN =====
const adminPage = {
  init: () => {
    if (document.getElementById("posts-admin-container")) {
      loadPostsAdmin()
      setupAdminEventListeners()
    }
  },
}

// Configurar event listeners del admin
function setupAdminEventListeners() {
  // Formulario de post
  const postForm = document.getElementById("post-form")
  if (postForm) {
    postForm.addEventListener("submit", handlePostSubmit)

    // Establecer fecha actual por defecto
    const dateInput = document.getElementById("post-date-input")
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split("T")[0]
    }
  }
}

// Manejar envío del formulario de post
async function handlePostSubmit(event) {
  event.preventDefault()

  const form = event.target
  const formData = new FormData(form)

  const postData = {
    id: document.getElementById("post-id").value || utils.generateId(),
    title: formData.get("title") || document.getElementById("post-title-input").value,
    date: formData.get("date") || document.getElementById("post-date-input").value,
    image: document.getElementById("post-image-input").value || "",
    excerpt: document.getElementById("post-excerpt-input").value || "",
    content: formData.get("content") || document.getElementById("post-content-input").value,
  }

  // Si no hay excerpt, generar uno automáticamente
  if (!postData.excerpt) {
    postData.excerpt = utils.createExcerpt(postData.content)
  }

  // Validar datos
  const errors = utils.validatePost(postData)
  if (errors.length > 0) {
    utils.showNotification(`Errores de validación: ${errors.join(", ")}`, "error")
    return
  }

  try {
    const updatedPosts = [...appState.posts]

    if (appState.editingPostId) {
      // Editar post existente
      const index = updatedPosts.findIndex((p) => p.id === appState.editingPostId)
      if (index !== -1) {
        updatedPosts[index] = postData
        utils.showNotification("Historia actualizada correctamente", "success")
      }
    } else {
      // Añadir nuevo post
      updatedPosts.push(postData)
      utils.showNotification("Nueva historia creada correctamente", "success")
    }

    await postsAPI.save(updatedPosts)

    // Limpiar formulario y recargar lista
    form.reset()
    cancelEdit()
    loadPostsAdmin()

    // Cambiar a la pestaña de lista
    showTab("posts-list")
  } catch (error) {
    utils.showNotification(`Error guardando historia: ${error.message}`, "error")
  }
}

// Cargar posts en el panel de administración
async function loadPostsAdmin() {
  const loadingEl = document.getElementById("admin-loading")
  const errorEl = document.getElementById("admin-error")
  const postsContainer = document.getElementById("posts-admin-container")

  if (loadingEl) loadingEl.style.display = "block"
  if (errorEl) errorEl.style.display = "none"
  if (postsContainer) postsContainer.style.display = "none"

  try {
    const posts = await postsAPI.load()

    if (loadingEl) loadingEl.style.display = "none"

    if (postsContainer) {
      if (posts.length === 0) {
        postsContainer.innerHTML = `
          <div class="no-posts">
            <div class="empty-state">
              <span class="empty-icon">☕</span>
              <h4>No hay historias disponibles</h4>
              <p>Crea tu primera historia sobre café usando el formulario.</p>
            </div>
          </div>
        `
      } else {
        postsContainer.innerHTML = posts
          .map((post) => {
            const excerpt = post.excerpt || utils.createExcerpt(post.content, 200)
            return `
              <div class="admin-post-item">
                <div class="admin-post-header">
                  <div>
                    <h4 class="admin-post-title">${utils.escapeHtml(post.title)}</h4>
                    <div class="admin-post-date">
                      <span>📅</span>
                      <time datetime="${post.date}">${utils.formatDate(post.date)}</time>
                    </div>
                  </div>
                  <div class="admin-post-actions">
                    <button onclick="editPost('${post.id}')" class="btn btn-info">
                      <span class="btn-icon">✏️</span>
                      Editar
                    </button>
                    <button onclick="deletePost('${post.id}')" class="btn btn-danger">
                      <span class="btn-icon">🗑️</span>
                      Eliminar
                    </button>
                  </div>
                </div>
                <div class="admin-post-content">
                  ${utils.escapeHtml(excerpt)}
                </div>
              </div>
            `
          })
          .join("")
      }

      postsContainer.style.display = "block"
    }
  } catch (error) {
    if (loadingEl) loadingEl.style.display = "none"

    if (errorEl) {
      const errorDetails = document.getElementById("admin-error-details")
      if (errorDetails) {
        errorDetails.textContent = error.message
      }
      errorEl.style.display = "block"
    }
  }
}

// Editar post
function editPost(postId) {
  const post = postsAPI.getById(postId)
  if (!post) {
    utils.showNotification("Historia no encontrada", "error")
    return
  }

  // Llenar formulario
  document.getElementById("post-id").value = post.id
  document.getElementById("post-title-input").value = post.title
  document.getElementById("post-date-input").value = post.date
  document.getElementById("post-image-input").value = post.image || ""
  document.getElementById("post-excerpt-input").value = post.excerpt || ""
  document.getElementById("post-content-input").value = post.content

  // Cambiar UI a modo edición
  document.getElementById("form-title").textContent = "Editar Historia del Café"
  document.getElementById("cancel-edit").style.display = "inline-flex"

  appState.editingPostId = postId

  // Cambiar a la pestaña del formulario
  showTab("add-post")

  utils.showNotification("Historia cargada para edición", "info")
}

// Cancelar edición
function cancelEdit() {
  document.getElementById("post-id").value = ""
  document.getElementById("form-title").textContent = "Nueva Historia del Café"
  document.getElementById("cancel-edit").style.display = "none"
  document.getElementById("post-form").reset()

  // Establecer fecha actual por defecto
  const dateInput = document.getElementById("post-date-input")
  if (dateInput) {
    dateInput.value = new Date().toISOString().split("T")[0]
  }

  appState.editingPostId = null
}

// Eliminar post
async function deletePost(postId) {
  const post = postsAPI.getById(postId)
  if (!post) {
    utils.showNotification("Historia no encontrada", "error")
    return
  }

  if (!confirm(`¿Estás seguro de que quieres eliminar "${post.title}"?\n\nEsta acción no se puede deshacer.`)) {
    return
  }

  try {
    const updatedPosts = appState.posts.filter((p) => p.id !== postId)
    await postsAPI.save(updatedPosts)

    utils.showNotification("Historia eliminada correctamente", "success")
    loadPostsAdmin()

    // Si estábamos editando este post, cancelar edición
    if (appState.editingPostId === postId) {
      cancelEdit()
    }
  } catch (error) {
    utils.showNotification(`Error eliminando historia: ${error.message}`, "error")
  }
}

// ===== FUNCIONES PARA EL EDITOR JSON =====
function loadJsonEditor() {
  const textarea = document.getElementById("json-textarea")
  if (textarea) {
    textarea.value = JSON.stringify(appState.posts, null, 2)
    clearJsonValidation()
  }
}

function validateJson() {
  const textarea = document.getElementById("json-textarea")
  const validationEl = document.getElementById("json-validation")

  if (!textarea || !validationEl) return

  const validation = utils.validatePostsJson(textarea.value)

  if (validation.valid) {
    validationEl.className = "validation-message success"
    validationEl.textContent = "✅ JSON válido - Estructura correcta para el blog de café"
  } else {
    validationEl.className = "validation-message error"
    validationEl.textContent = `❌ ${validation.error}`
  }
}

function clearJsonValidation() {
  const validationEl = document.getElementById("json-validation")
  if (validationEl) {
    validationEl.className = "validation-message"
    validationEl.textContent = ""
  }
}

function copyJson() {
  const textarea = document.getElementById("json-textarea")
  if (textarea) {
    textarea.select()
    document.execCommand("copy")
    utils.showNotification("JSON copiado al portapapeles", "success")
  }
}

async function saveJson() {
  const textarea = document.getElementById("json-textarea")
  if (!textarea) return

  const validation = utils.validatePostsJson(textarea.value)

  if (!validation.valid) {
    utils.showNotification(`No se puede guardar: ${validation.error}`, "error")
    validateJson() // Mostrar errores
    return
  }

  try {
    await postsAPI.save(validation.data)
    utils.showNotification("JSON guardado correctamente", "success")
    loadPostsAdmin()
    clearJsonValidation()
  } catch (error) {
    utils.showNotification(`Error guardando JSON: ${error.message}`, "error")
  }
}

function resetJson() {
  if (confirm("¿Estás seguro de que quieres resetear el JSON?\n\nSe perderán los cambios no guardados.")) {
    loadJsonEditor()
    utils.showNotification("JSON reseteado", "info")
  }
}

// ===== FUNCIONES PARA LAS PESTAÑAS DEL ADMIN =====
function showTab(tabName) {
  // Ocultar todas las pestañas
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active")
  })

  // Desactivar todos los botones
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active")
  })

  // Mostrar pestaña seleccionada
  const selectedTab = document.getElementById(tabName)
  if (selectedTab) {
    selectedTab.classList.add("active")
  }

  // Activar botón correspondiente
  const selectedBtn = document.querySelector(`[onclick="showTab('${tabName}')"]`)
  if (selectedBtn) {
    selectedBtn.classList.add("active")
  }

  // Cargar contenido específico de la pestaña
  if (tabName === "json-editor") {
    loadJsonEditor()
  }
}

// ===== INICIALIZACIÓN CUANDO EL DOM ESTÉ LISTO =====
document.addEventListener("DOMContentLoaded", () => {
  try {
    // Determinar qué página estamos cargando y ejecutar la inicialización apropiada
    const path = window.location.pathname
    const filename = path.split("/").pop() || "index.html"

    switch (filename) {
      case "index.html":
      case "":
        homePage.init()
        break
      case "post.html":
        postPage.init()
        break
      case "admin.html":
        adminPage.init()
        break
      default:
        console.warn("Página no reconocida:", filename)
    }

    // Configurar navegación móvil
    const mobileMenuBtn = document.querySelector(".mobile-menu-btn")
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener("click", toggleMobileMenu)
    }
  } catch (error) {
    console.error("Error durante la inicialización:", error)
    utils.showNotification("Error inicializando la aplicación", "error")
  }
})

// ===== MANEJO DE ERRORES GLOBALES =====
window.addEventListener("error", (event) => {
  console.error("Error global:", event.error)
  utils.showNotification("Se produjo un error inesperado", "error")
})

// Manejo de errores de promesas no capturadas
window.addEventListener("unhandledrejection", (event) => {
  console.error("Promise rechazada no manejada:", event.reason)
  utils.showNotification("Error de conexión o carga de datos", "error")
  event.preventDefault()
})

// ===== FUNCIONES DE UTILIDAD ADICIONALES =====

// Lazy loading para imágenes
function setupLazyLoading() {
  if ("IntersectionObserver" in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target
          img.src = img.dataset.src
          img.classList.remove("lazy")
          imageObserver.unobserve(img)
        }
      })
    })

    document.querySelectorAll("img[data-src]").forEach((img) => {
      imageObserver.observe(img)
    })
  }
}

// Smooth scroll mejorado
function smoothScrollTo(target) {
  const element = document.querySelector(target)
  if (element) {
    const headerHeight = document.querySelector(".header").offsetHeight
    const elementPosition = element.offsetTop - headerHeight - 20

    window.scrollTo({
      top: elementPosition,
      behavior: "smooth",
    })
  }
}

// Detectar scroll para efectos
let ticking = false

function updateScrollEffects() {
  const scrolled = window.pageYOffset
  const header = document.querySelector(".header")

  if (header) {
    if (scrolled > 100) {
      header.style.background = "rgba(255, 255, 255, 0.98)"
      header.style.boxShadow = "0 2px 20px rgba(45, 27, 20, 0.1)"
    } else {
      header.style.background = "rgba(255, 255, 255, 0.95)"
      header.style.boxShadow = "none"
    }
  }

  ticking = false
}

window.addEventListener("scroll", () => {
  if (!ticking) {
    requestAnimationFrame(updateScrollEffects)
    ticking = true
  }
})
