// Configuración global
const CONFIG = {
  POSTS_FILE: "data/posts.json",
  MAX_EXCERPT_LENGTH: 150,
  DATE_FORMAT_OPTIONS: {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
}

// Estado global de la aplicación
const appState = {
  posts: [],
  currentPost: null,
  isLoading: false,
  error: null,
  editingPostId: null,
}

// Utilidades
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
        errors.push("Fecha debe tener formato válido")
      }
    }

    if (!post.content || typeof post.content !== "string" || post.content.trim().length === 0) {
      errors.push("Contenido es requerido y no puede estar vacío")
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

  // Mostrar notificación
  showNotification: (message, type = "info") => {
    // Crear elemento de notificación
    const notification = document.createElement("div")
    notification.className = `notification notification-${type}`
    notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" aria-label="Cerrar notificación">&times;</button>
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
                    border-radius: 0.5rem;
                    color: white;
                    font-weight: 500;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    max-width: 400px;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                    animation: slideIn 0.3s ease;
                }
                .notification-info { background-color: #0891b2; }
                .notification-success { background-color: #059669; }
                .notification-error { background-color: #dc2626; }
                .notification-warning { background-color: #d97706; }
                .notification button {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.25rem;
                    cursor: pointer;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                @keyframes slideIn {
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
        notification.remove()
      }
    }, 5000)
  },
}

// API para manejar posts
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

  // Simular guardado (en una aplicación real, esto sería una llamada al servidor)
  save: async (posts) => {
    try {
      // Validar datos antes de "guardar"
      const validation = utils.validatePostsJson(JSON.stringify(posts))
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      // Simular delay de red
      await new Promise((resolve) => setTimeout(resolve, 500))

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

// Funciones para la página principal (index.html)
const homePage = {
  init: () => {
    if (document.getElementById("posts-container")) {
      loadPosts()
    }
  },
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
        .map(
          (post) => `
                <article class="post-card">
                    <h3 class="post-card-title">
                        <a href="post.html?id=${encodeURIComponent(post.id)}">${escapeHtml(post.title)}</a>
                    </h3>
                    <time class="post-card-date" datetime="${post.date}">
                        ${utils.formatDate(post.date)}
                    </time>
                    <p class="post-card-excerpt">${escapeHtml(utils.createExcerpt(post.content))}</p>
                    <a href="post.html?id=${encodeURIComponent(post.id)}" class="read-more">
                        Leer más →
                    </a>
                </article>
            `,
        )
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

// Funciones para la página de post individual (post.html)
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
      showPostError(`No se encontró el post con ID: ${postId}`)
      return
    }

    // Actualizar título de la página
    document.title = `${post.title} - Mi Blog Personal`

    // Mostrar contenido del post
    if (postContent) {
      const titleEl = document.getElementById("article-title")
      const dateEl = document.getElementById("article-date")
      const contentEl = document.getElementById("article-content")

      if (titleEl) titleEl.textContent = post.title
      if (dateEl) {
        dateEl.textContent = utils.formatDate(post.date)
        dateEl.setAttribute("datetime", post.date)
      }
      if (contentEl) {
        // Convertir saltos de línea a párrafos HTML
        const formattedContent = post.content
          .split("\n\n")
          .map((paragraph) => paragraph.trim())
          .filter((paragraph) => paragraph.length > 0)
          .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
          .join("")

        contentEl.innerHTML = formattedContent
      }

      postContent.style.display = "block"
    }

    appState.currentPost = post
  } catch (error) {
    if (loadingEl) loadingEl.style.display = "none"
    showPostError(`Error cargando el post: ${error.message}`)
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

// Funciones para el panel de administración (admin.html)
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
    content: formData.get("content") || document.getElementById("post-content-input").value,
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
        utils.showNotification("Post actualizado correctamente", "success")
      }
    } else {
      // Añadir nuevo post
      updatedPosts.push(postData)
      utils.showNotification("Post creado correctamente", "success")
    }

    await postsAPI.save(updatedPosts)

    // Limpiar formulario y recargar lista
    form.reset()
    cancelEdit()
    loadPostsAdmin()

    // Cambiar a la pestaña de lista
    showTab("posts-list")
  } catch (error) {
    utils.showNotification(`Error guardando post: ${error.message}`, "error")
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
                        <h4>No hay posts disponibles</h4>
                        <p>Crea tu primer post usando el formulario.</p>
                    </div>
                `
      } else {
        postsContainer.innerHTML = posts
          .map(
            (post) => `
                    <div class="admin-post-item">
                        <div class="admin-post-header">
                            <div>
                                <h4 class="admin-post-title">${escapeHtml(post.title)}</h4>
                                <time class="admin-post-date" datetime="${post.date}">
                                    ${utils.formatDate(post.date)}
                                </time>
                            </div>
                            <div class="admin-post-actions">
                                <button onclick="editPost('${post.id}')" class="btn btn-info">Editar</button>
                                <button onclick="deletePost('${post.id}')" class="btn btn-danger">Eliminar</button>
                            </div>
                        </div>
                        <div class="admin-post-content">
                            ${escapeHtml(utils.createExcerpt(post.content, 200))}
                        </div>
                    </div>
                `,
          )
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
    utils.showNotification("Post no encontrado", "error")
    return
  }

  // Llenar formulario
  document.getElementById("post-id").value = post.id
  document.getElementById("post-title-input").value = post.title
  document.getElementById("post-date-input").value = post.date
  document.getElementById("post-content-input").value = post.content

  // Cambiar UI a modo edición
  document.getElementById("form-title").textContent = "Editar Post"
  document.getElementById("cancel-edit").style.display = "inline-block"

  appState.editingPostId = postId

  // Cambiar a la pestaña del formulario
  showTab("add-post")

  utils.showNotification("Post cargado para edición", "info")
}

// Cancelar edición
function cancelEdit() {
  document.getElementById("post-id").value = ""
  document.getElementById("form-title").textContent = "Añadir Nuevo Post"
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
    utils.showNotification("Post no encontrado", "error")
    return
  }

  if (!confirm(`¿Estás seguro de que quieres eliminar "${post.title}"?`)) {
    return
  }

  try {
    const updatedPosts = appState.posts.filter((p) => p.id !== postId)
    await postsAPI.save(updatedPosts)

    utils.showNotification("Post eliminado correctamente", "success")
    loadPostsAdmin()

    // Si estábamos editando este post, cancelar edición
    if (appState.editingPostId === postId) {
      cancelEdit()
    }
  } catch (error) {
    utils.showNotification(`Error eliminando post: ${error.message}`, "error")
  }
}

// Funciones para el editor JSON
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
    validationEl.textContent = "✓ JSON válido - Estructura correcta"
  } else {
    validationEl.className = "validation-message error"
    validationEl.textContent = `✗ ${validation.error}`
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
  if (confirm("¿Estás seguro de que quieres resetear el JSON? Se perderán los cambios no guardados.")) {
    loadJsonEditor()
    utils.showNotification("JSON reseteado", "info")
  }
}

// Funciones para las pestañas del admin
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

// Función para escapar HTML
function escapeHtml(text) {
  if (typeof text !== "string") return ""

  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

// Inicialización cuando el DOM esté listo
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
  } catch (error) {
    console.error("Error durante la inicialización:", error)
    utils.showNotification("Error inicializando la aplicación", "error")
  }
})

// Manejo de errores globales
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
