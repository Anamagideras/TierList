class TierListManager {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.loadSavedLists();
        this.loadAutoSavedState(); // Nova funcionalidade: carrega estado automaticamente
    }

    initializeElements() {
        this.imageUpload = document.getElementById("imageUpload");
        this.unrankedGames = document.getElementById("unrankedGames");
        this.saveBtn = document.getElementById("saveBtn");
        this.loadBtn = document.getElementById("loadBtn");
        this.clearBtn = document.getElementById("clearBtn");
        this.darkModeBtn = document.getElementById("darkModeBtn");
        this.saveModal = document.getElementById("saveModal");
        this.loadModal = document.getElementById("loadModal");
        this.saveNameInput = document.getElementById("saveNameInput");
        this.confirmSave = document.getElementById("confirmSave");
        this.savedLists = document.getElementById("savedLists");
        this.tierContents = document.querySelectorAll(".tier-content");
        this.currentHoveredGame = null;
        this.isResizing = false;
        this.currentResizeItem = null;
        this.draggedElement = null;
    }

    setupEventListeners() {
        this.imageUpload.addEventListener("change", (e) => this.handleImageUpload(e));
        this.saveBtn.addEventListener("click", () => this.showSaveModal());
        this.loadBtn.addEventListener("click", () => this.showLoadModal());
        this.clearBtn.addEventListener("click", () => this.clearAll());
        this.darkModeBtn.addEventListener("click", () => this.toggleDarkMode());
        this.confirmSave.addEventListener("click", () => this.saveTierList());
        document.addEventListener("keydown", (e) => this.handleKeyPress(e));
        document.addEventListener("paste", (e) => this.handlePaste(e));
        document.addEventListener("mousemove", (e) => this.handleMouseMove(e));
        document.addEventListener("mouseup", (e) => this.handleMouseUp(e));

        document.querySelectorAll(".close").forEach(closeBtn => {
            closeBtn.addEventListener("click", (e) => {
                e.target.closest(".modal").style.display = "none";
            });
        });

        window.addEventListener("click", (e) => {
            if (e.target.classList.contains("modal")) {
                e.target.style.display = "none";
            }
        });

        this.setupDragAndDrop();
        this.loadDarkModePreference();
    }

    handleImageUpload(event) {
        const files = Array.from(event.target.files);
        files.forEach(file => {
            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.createGameItem(e.target.result, file.name);
                    this.autoSaveState(); // Nova funcionalidade: salva automaticamente após adicionar item
                };
                reader.readAsDataURL(file);
            }
        });
        event.target.value = "";
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
        return gameItem; // Retorna o item criado para uso em outras funções
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
            this.autoSaveState(); // Nova funcionalidade: salva automaticamente após mudança
        });
        
        downOption.addEventListener("click", (e) => {
            e.stopPropagation();
            gameItem.dataset.selectedSubOption = currentTier + "-";
            tierSelection.textContent = currentTier + "-";
            this.autoSaveState(); // Nova funcionalidade: salva automaticamente após mudança
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
            this.autoSaveState(); // Nova funcionalidade: salva automaticamente após mover item
        }
    }

    // Nova funcionalidade: salvamento automático
    autoSaveState() {
        try {
            const tierListData = this.exportTierListData();
            localStorage.setItem("tierListAutoSave", JSON.stringify({
                data: tierListData,
                timestamp: new Date().toISOString()
            }));
            console.log("Estado da tierlist salvo automaticamente");
        } catch (error) {
            console.error("Erro ao salvar automaticamente:", error);
        }
    }

    // Nova funcionalidade: carregamento automático
    loadAutoSavedState() {
        try {
            const autoSavedData = localStorage.getItem("tierListAutoSave");
            if (autoSavedData) {
                const parsedData = JSON.parse(autoSavedData);
                this.importTierListData(parsedData.data);
                console.log("Estado anterior da tierlist restaurado automaticamente");
            }
        } catch (error) {
            console.error("Erro ao carregar estado salvo automaticamente:", error);
        }
    }

    // Nova funcionalidade: limpar salvamento automático
    clearAutoSavedState() {
        try {
            localStorage.removeItem("tierListAutoSave");
            console.log("Salvamento automático limpo");
        } catch (error) {
            console.error("Erro ao limpar salvamento automático:", error);
        }
    }

    saveTierList() {
        const name = this.saveNameInput.value.trim();
        if (!name) {
            alert("Por favor, digite um nome para a tier list.");
            return;
        }
        const tierListData = this.exportTierListData();
        const savedLists = JSON.parse(localStorage.getItem("tierLists") || "{}");
        savedLists[name] = {
            data: tierListData,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem("tierLists", JSON.stringify(savedLists));
        this.saveModal.style.display = "none";
        this.saveNameInput.value = "";
        alert("Tier list salva com sucesso!");
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
                tierSelection: item.dataset.selectedSubOption || item.querySelector(".tier-selection")?.textContent || ""
            });
        });

        this.tierContents.forEach(tierContent => {
            const tierName = tierContent.dataset.tier;
            tierContent.querySelectorAll(".game-item").forEach(item => {
                data.tiers[tierName].push({
                    src: item.querySelector("img").src,
                    fileName: item.dataset.fileName,
                    tierSelection: item.dataset.selectedSubOption || item.querySelector(".tier-selection")?.textContent || tierName
                });
            });
        });

        return data;
    }

    importTierListData(data) {
        // Limpa o estado atual antes de importar
        this.unrankedGames.innerHTML = "";
        this.tierContents.forEach(tierContent => {
            tierContent.innerHTML = "";
        });

        // Importa itens não ranqueados
        if (data.unranked) {
            data.unranked.forEach(game => {
                const gameItem = this.createGameItemFromData(game.src, game.fileName);
                const tierSelection = gameItem.querySelector(".tier-selection");
                if (tierSelection) {
                    tierSelection.textContent = game.tierSelection || "";
                    gameItem.dataset.selectedSubOption = game.tierSelection || "";
                }
                this.unrankedGames.appendChild(gameItem);
            });
        }

        // Importa itens das tiers
        if (data.tiers) {
            Object.entries(data.tiers).forEach(([tierName, games]) => {
                const tierContent = document.querySelector(`[data-tier="${tierName}"]`);
                if (tierContent && games) {
                    games.forEach(game => {
                        const gameItem = this.createGameItemFromData(game.src, game.fileName);
                        gameItem.dataset.tier = tierName;
                        gameItem.dataset.selectedSubOption = game.tierSelection || "";

                        const tierSelection = gameItem.querySelector(".tier-selection");
                        tierSelection.textContent = game.tierSelection || tierName;

                        this.setupTierOptions(gameItem);
                        tierContent.appendChild(gameItem);
                    });
                }
            });
        }
    }

    // Nova função auxiliar para criar itens de jogo a partir de dados salvos
    createGameItemFromData(imageSrc, fileName) {
        const gameItem = document.createElement("div");
        gameItem.className = "game-item";
        gameItem.draggable = true;
        gameItem.dataset.fileName = fileName;

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

        return gameItem;
    }

    showSaveModal() {
        this.saveModal.style.display = "block";
        this.saveNameInput.focus();
    }

    showLoadModal() {
        this.loadModal.style.display = "block";
        this.displaySavedLists();
    }

    displaySavedLists() {
        const savedLists = JSON.parse(localStorage.getItem("tierLists") || "{}");
        this.savedLists.innerHTML = "";

        if (Object.keys(savedLists).length === 0) {
            this.savedLists.innerHTML = "<p>Nenhuma tier list salva encontrada.</p>";
            return;
        }

        Object.entries(savedLists).forEach(([name, listData]) => {
            const listItem = document.createElement("div");
            listItem.className = "saved-list-item";
            const date = new Date(listData.timestamp).toLocaleDateString("pt-BR");
            listItem.innerHTML = `
                <div>
                    <strong>${name}</strong><br>
                    <small>Salva em: ${date}</small>
                </div>
                <div>
                    <button class="load-list-btn" onclick="tierListManager.loadTierList('${name}')">Carregar</button>
                    <button class="delete-list-btn" onclick="tierListManager.deleteSavedList('${name}')">Deletar</button>
                </div>
            `;
            this.savedLists.appendChild(listItem);
        });
    }

    loadTierList(name) {
        const savedLists = JSON.parse(localStorage.getItem("tierLists") || "{}");
        const listData = savedLists[name];
        if (!listData) {
            alert("Tier list não encontrada.");
            return;
        }
        if (confirm("Carregar esta tier list irá substituir a atual. Continuar?")) {
            this.clearAll(false);
            this.importTierListData(listData.data);
            this.loadModal.style.display = "none";
            this.autoSaveState(); // Salva o novo estado automaticamente
            alert("Tier list carregada com sucesso!");
        }
    }

    deleteSavedList(name) {
        if (confirm(`Tem certeza que deseja deletar a tier list "${name}"?`)) {
            const savedLists = JSON.parse(localStorage.getItem("tierLists") || "{}");
            delete savedLists[name];
            localStorage.setItem("tierLists", JSON.stringify(savedLists));
            this.displaySavedLists();
            alert("Tier list deletada com sucesso!");
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
        this.clearAutoSavedState(); // Nova funcionalidade: limpa o salvamento automático
    }

    loadSavedLists() {
        const savedLists = JSON.parse(localStorage.getItem("tierLists") || "{}");
        console.log(`${Object.keys(savedLists).length} tier lists salvas encontradas.`);
    }

    toggleDarkMode() {
        document.body.classList.toggle("dark-mode");
        const isDarkMode = document.body.classList.contains("dark-mode");
        this.darkModeBtn.textContent = isDarkMode ? "☀️ Modo Claro" : "🌙 Modo Escuro";
        localStorage.setItem("darkMode", isDarkMode);
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
                    this.autoSaveState(); // Nova funcionalidade: salva automaticamente
                } else if (event.key === "-") {
                    event.preventDefault();
                    gameItem.dataset.selectedSubOption = currentTier + "-";
                    tierSelection.textContent = currentTier + "-";
                    this.autoSaveState(); // Nova funcionalidade: salva automaticamente
                } else if (event.key === "Backspace") {
                    event.preventDefault();
                    gameItem.dataset.selectedSubOption = "";
                    tierSelection.textContent = currentTier;
                    this.autoSaveState(); // Nova funcionalidade: salva automaticamente
                }
            }
        }

        if (event.key === "Delete" && this.currentHoveredGame) {
            event.preventDefault();
            if (confirm("Tem certeza que deseja deletar este jogo?")) {
                this.currentHoveredGame.remove();
                this.currentHoveredGame = null;
                this.autoSaveState(); // Nova funcionalidade: salva automaticamente após deletar
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
                    this.autoSaveState(); // Nova funcionalidade: salva automaticamente após colar
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
            this.autoSaveState(); // Nova funcionalidade: salva automaticamente após redimensionar
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

