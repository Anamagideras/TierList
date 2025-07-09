class TierListManager {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.setupAutoSave();
        this.loadAutoSavedData();
    }

    initializeElements() {
        this.imageUpload = document.getElementById("imageUpload");
        this.unrankedGames = document.getElementById("unrankedGames");
        this.clearBtn = document.getElementById("clearBtn");
        this.darkModeBtn = document.getElementById("darkModeBtn");
        this.tierContents = document.querySelectorAll(".tier-content");
        this.autoSaveIndicator = document.getElementById("autoSaveIndicator");
        this.currentHoveredGame = null;
        this.isResizing = false;
        this.currentResizeItem = null;
        this.draggedElement = null;
        this.hasChanges = false;
    }

    setupEventListeners() {
        this.imageUpload.addEventListener("change", (e) => this.handleImageUpload(e));
        this.clearBtn.addEventListener("click", () => this.clearAll());
        this.darkModeBtn.addEventListener("click", () => this.toggleDarkMode());
        document.addEventListener("keydown", (e) => this.handleKeyPress(e));
        document.addEventListener("paste", (e) => this.handlePaste(e));
        document.addEventListener("mousemove", (e) => this.handleMouseMove(e));
        document.addEventListener("mouseup", (e) => this.handleMouseUp(e));

        // Observar alterações na tier list
        this.setupMutationObserver();
        this.setupDragAndDrop();
        this.loadDarkModePreference();
    }

    // =====================
    // SALVAMENTO AUTOMÁTICO
    // =====================
    setupAutoSave() {
        // Salvar a cada 30 segundos
        this.autoSaveInterval = setInterval(() => {
            if (this.hasChanges) {
                this.autoSave();
                this.hasChanges = false;
            }
        }, 30000);
        
        // Salvar também quando o usuário sair da página
        window.addEventListener("beforeunload", () => {
            if (this.hasChanges) {
                this.autoSave();
            }
        });
    }

    markChanges() {
        this.hasChanges = true;
    }

    autoSave() {
        const tierListData = this.exportTierListData();
        localStorage.setItem("autoSavedTierList", JSON.stringify(tierListData));
        this.showAutoSaveIndicator();
    }

    showAutoSaveIndicator(message = "✓ Salvando...") {
        this.autoSaveIndicator.textContent = message;
        this.autoSaveIndicator.classList.add("visible");
        setTimeout(() => {
            this.autoSaveIndicator.classList.remove("visible");
        }, 2000);
    }

    loadAutoSavedData() {
        const savedData = localStorage.getItem("autoSavedTierList");
        if (savedData) {
            const data = JSON.parse(savedData);
            this.importTierListData(data);
            this.showAutoSaveIndicator("✓ Tier list restaurada");
        }
    }

    exportTierListData() {
        const data = {
            unranked: [],
            tiers: {
                GOTY: [], AAA: [], AA: [], A: [], B: [], C: [], D: [], E: [], F: []
            }
        };

        this.unrankedGames.querySelectorAll(".game-item").forEach(item => {
            data.unranked.push({
                src: item.querySelector("img").src,
                fileName: item.dataset.fileName,
                tierSelection: item.dataset.selectedSubOption || item.querySelector(".tier-selection")?.textContent || "",
                width: item.style.width || "80px",
                height: item.style.height || "80px"
            });
        });

        this.tierContents.forEach(tierContent => {
            const tierName = tierContent.dataset.tier;
            tierContent.querySelectorAll(".game-item").forEach(item => {
                data.tiers[tierName].push({
                    src: item.querySelector("img").src,
                    fileName: item.dataset.fileName,
                    tierSelection: item.dataset.selectedSubOption || item.querySelector(".tier-selection")?.textContent || tierName,
                    width: item.style.width || "80px",
                    height: item.style.height || "80px"
                });
            });
        });

        return data;
    }

    importTierListData(data) {
        this.clearAll(false);

        // Primeiro, adicionamos os jogos não classificados
        data.unranked.forEach(game => {
            const gameItem = this.createGameItem(game.src, game.fileName);
            if (game.tierSelection) {
                const tierSelection = gameItem.querySelector(".tier-selection");
                tierSelection.textContent = game.tierSelection;
                gameItem.dataset.selectedSubOption = game.tierSelection;
            }
            if (game.width) gameItem.style.width = game.width;
            if (game.height) gameItem.style.height = game.height;
        });

        // Em seguida, adicionamos os jogos classificados
        Object.entries(data.tiers).forEach(([tierName, games]) => {
            const tierContent = document.querySelector(`.tier-content[data-tier="${tierName}"]`);
            if (tierContent) {
                games.forEach(game => {
                    const gameItem = document.createElement("div");
                    gameItem.className = "game-item";
                    gameItem.draggable = true;
                    gameItem.dataset.fileName = game.fileName;
                    gameItem.dataset.tier = tierName;
                    gameItem.dataset.selectedSubOption = game.tierSelection || "";

                    // Aplicar tamanhos personalizados
                    if (game.width) gameItem.style.width = game.width;
                    if (game.height) gameItem.style.height = game.height;
                    
                    gameItem.innerHTML = `
                        <img src="${game.src}" alt="${game.fileName}">
                        <div class="tier-selection">${game.tierSelection || tierName}</div>
                        <div class="tier-options"></div>
                        <div class="resize-handle"></div>
                    `;

                    // Configurar event listeners
                    gameItem.addEventListener("dragstart", (e) => this.handleDragStart(e));
                    gameItem.addEventListener("dragend", (e) => this.handleDragEnd(e));
                    gameItem.addEventListener("mouseenter", () => {
                        this.currentHoveredGame = gameItem;
                    });
                    gameItem.addEventListener("mouseleave", () => {
                        if (this.currentHoveredGame === gameItem) {
                            this.currentHoveredGame = null;
                        }
                    });

                    const resizeHandle = gameItem.querySelector(".resize-handle");
                    resizeHandle.addEventListener("mousedown", (e) => this.handleResizeStart(e, gameItem));

                    // Adicionar diretamente ao conteúdo do tier
                    tierContent.appendChild(gameItem);
                    
                    // Configurar opções de tier
                    this.setupTierOptions(gameItem);
                });
            }
        });
    }

    // Observar alterações na estrutura da tier list
    setupMutationObserver() {
        const observer = new MutationObserver(() => this.markChanges());
        
        // Observar alterações nas áreas de jogos (adicionar/remover itens)
        observer.observe(this.unrankedGames, { childList: true, subtree: true });
        this.tierContents.forEach(content => {
            observer.observe(content, { childList: true, subtree: true });
        });
    }

    // =====================
    // FUNÇÕES EXISTENTES
    // =====================
    handleImageUpload(event) {
        const files = Array.from(event.target.files);
        files.forEach(file => {
            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.createGameItem(e.target.result, file.name);
                };
                reader.readAsDataURL(file);
            }
        });
        event.target.value = "";
        this.markChanges();
    }

    createGameItem(imageSrc, fileName) {
        const gameItem = document.createElement("div");
        gameItem.className = "game-item";
        gameItem.draggable = true;
        gameItem.dataset.fileName = fileName;
        gameItem.dataset.tier = "unranked";

        gameItem.innerHTML = `
            <img src="${imageSrc}" alt="${fileName}">
            <div class="tier-selection"></div>
            <div class="tier-options"></div>
            <div class="resize-handle"></div>
        `;

        gameItem.addEventListener("dragstart", (e) => this.handleDragStart(e));
        gameItem.addEventListener("dragend", (e) => this.handleDragEnd(e));
        gameItem.addEventListener("mouseenter", () => {
            this.currentHoveredGame = gameItem;
        });
        gameItem.addEventListener("mouseleave", () => {
            if (this.currentHoveredGame === gameItem) {
                this.currentHoveredGame = null;
            }
        });

        const resizeHandle = gameItem.querySelector(".resize-handle");
        resizeHandle.addEventListener("mousedown", (e) => this.handleResizeStart(e, gameItem));

        this.unrankedGames.appendChild(gameItem);
        this.markChanges();
        return gameItem;
    }

    setupTierOptions(gameItem) {
        const tierOptions = gameItem.querySelector(".tier-options");
        const currentTier = gameItem.parentElement.dataset.tier || "unranked";
        gameItem.dataset.tier = currentTier;
        
        const tierSelection = gameItem.querySelector(".tier-selection");
        tierSelection.textContent = currentTier === "unranked" ? "" : currentTier;
        
        if (currentTier === "unranked") {
            tierOptions.innerHTML = "";
            return;
        }
        
        tierOptions.innerHTML = "";
        
        const upOption = document.createElement("div");
        upOption.className = "tier-option tier-up";
        upOption.textContent = currentTier + "+";
        
        const downOption = document.createElement("div");
        downOption.className = "tier-option tier-down";
        downOption.textContent = currentTier + "-";
        
        tierOptions.appendChild(upOption);
        tierOptions.appendChild(downOption);
        
        upOption.addEventListener("click", (e) => {
            e.stopPropagation();
            gameItem.dataset.selectedSubOption = currentTier + "+";
            tierSelection.textContent = currentTier + "+";
            this.markChanges();
        });
        
        downOption.addEventListener("click", (e) => {
            e.stopPropagation();
            gameItem.dataset.selectedSubOption = currentTier + "-";
            tierSelection.textContent = currentTier + "-";
            this.markChanges();
        });
    }

    setupDragAndDrop() {
        const dropZones = [this.unrankedGames, ...this.tierContents];
        dropZones.forEach(zone => {
            zone.addEventListener("dragover", (e) => this.handleDragOver(e));
            zone.addEventListener("drop", (e) => this.handleDrop(e));
            zone.addEventListener("dragenter", (e) => this.handleDragEnter(e));
            zone.addEventListener("dragleave", (e) => this.handleDragLeave(e));
        });
    }

    handleDragStart(e) {
        e.dataTransfer.setData("text/plain", "");
        e.target.classList.add("dragging");
        this.draggedElement = e.target;
    }

    handleDragEnd(e) {
        e.target.classList.remove("dragging");
        this.draggedElement = null;
        document.querySelectorAll(".drag-over").forEach(zone => {
            zone.classList.remove("drag-over");
        });
    }

    handleDragOver(e) {
        e.preventDefault();
    }

    handleDragEnter(e) {
        e.preventDefault();
        if (e.target.classList.contains("tier-content") || e.target.classList.contains("games-container")) {
            e.target.classList.add("drag-over");
        }
    }

    handleDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove("drag-over");
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const dropZone = e.currentTarget;
        dropZone.classList.remove("drag-over");
        if (this.draggedElement && dropZone !== this.draggedElement.parentNode) {
            dropZone.appendChild(this.draggedElement);
            this.setupTierOptions(this.draggedElement);
            this.markChanges();
        }
    }

    clearAll(confirm = true) {
        if (confirm && !window.confirm("Tem certeza que deseja limpar toda a tier list?")) {
            return;
        }
        this.unrankedGames.innerHTML = "";
        this.tierContents.forEach(tierContent => {
            tierContent.innerHTML = "";
        });
        this.markChanges();
    }

    toggleDarkMode() {
        document.body.classList.toggle("dark-mode");
        const isDarkMode = document.body.classList.contains("dark-mode");
        this.darkModeBtn.textContent = isDarkMode ? "☀️ Modo Claro" : "🌙 Modo Escuro";
        localStorage.setItem("darkMode", isDarkMode);
        this.markChanges();
    }

    loadDarkModePreference() {
        const isDarkMode = localStorage.getItem("darkMode") === "true";
        if (isDarkMode) {
            document.body.classList.add("dark-mode");
            this.darkModeBtn.textContent = "☀️ Modo Claro";
        }
    }

    handleKeyPress(event) {
        if (this.currentHoveredGame) {
            const gameItem = this.currentHoveredGame;
            const currentTier = gameItem.parentElement.dataset.tier;
            const tierSelection = gameItem.querySelector(".tier-selection");

            if (currentTier && currentTier !== "unranked") {
                if (event.key === "+") {
                    event.preventDefault();
                    gameItem.dataset.selectedSubOption = currentTier + "+";
                    tierSelection.textContent = currentTier + "+";
                    this.markChanges();
                } else if (event.key === "-") {
                    event.preventDefault();
                    gameItem.dataset.selectedSubOption = currentTier + "-";
                    tierSelection.textContent = currentTier + "-";
                    this.markChanges();
                } else if (event.key === "Backspace") {
                    event.preventDefault();
                    gameItem.dataset.selectedSubOption = "";
                    tierSelection.textContent = currentTier;
                    this.markChanges();
                }
            }
        }

        if (event.key === "Delete" && this.currentHoveredGame) {
            event.preventDefault();
            if (confirm("Tem certeza que deseja deletar este jogo?")) {
                this.currentHoveredGame.remove();
                this.currentHovereredGame = null;
                this.markChanges();
            }
        }
    }

    handlePaste(event) {
        const items = event.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf("image") !== -1) {
                event.preventDefault();
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (e) => {
                    const timestamp = new Date().getTime();
                    const fileName = `Imagem_Colada_${timestamp}`;
                    this.createGameItem(e.target.result, fileName);
                };
                reader.readAsDataURL(blob);
                break;
            }
        }
    }

    handleResizeStart(event, gameItem) {
        event.preventDefault();
        event.stopPropagation();
        this.isResizing = true;
        this.currentResizeItem = gameItem;
        gameItem.draggable = false;
        this.startX = event.clientX;
        this.startY = event.clientY;
        this.startWidth = parseInt(window.getComputedStyle(gameItem).width, 10);
        this.startHeight = parseInt(window.getComputedStyle(gameItem).height, 10);
        gameItem.classList.add("resizing");
        document.body.style.userSelect = "none";
    }

    handleMouseMove(event) {
        if (!this.isResizing || !this.currentResizeItem) return;
        event.preventDefault();
        const deltaX = event.clientX - this.startX;
        const deltaY = event.clientY - this.startY;
        let newWidth = this.startWidth + deltaX;
        let newHeight = this.startHeight + deltaY;
        newWidth = Math.max(40, Math.min(150, newWidth));
        newHeight = Math.max(40, Math.min(150, newHeight));
        const size = Math.min(newWidth, newHeight);
        this.currentResizeItem.style.width = `${size}px`;
        this.currentResizeItem.style.height = `${size}px`;
    }

    handleMouseUp(event) {
        if (!this.isResizing) return;
        this.isResizing = false;
        if (this.currentResizeItem) {
            this.currentResizeItem.draggable = true;
            this.currentResizeItem.classList.remove("resizing");
            this.currentResizeItem = null;
            this.markChanges();
        }
        document.body.style.userSelect = "";
    }
}

let tierListManager;
document.addEventListener("DOMContentLoaded", () => {
    tierListManager = new TierListManager();
});
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => e.preventDefault());
