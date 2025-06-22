// app.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Get references to ALL possible HTML elements ---
    const productImage = document.getElementById('productImage');
    const currentProductIdInput = document.getElementById('currentProductId');
    const productQuantityInput = document.getElementById('productQuantity');
    const materialUsageSpan = document.getElementById('materialUsage');
    const printTimeSpan = document.getElementById('printTime');
    const estimatedCostSpan = document.getElementById('estimatedCost');
    const designFeeSpan = document.getElementById('designFee');
    const myQuotesSection = document.getElementById('my-quotes-section');
    const myQuotesList = document.getElementById('myQuotesList');
    const saveQuoteBtn = document.getElementById('saveQuoteBtn');
    const orderModal = document.getElementById('orderModal');
    const openOrderModalBtn = document.getElementById('openOrderModalBtn');
    const closeModalBtn = document.querySelector('.close-button');
    const orderForm = document.getElementById('orderForm');
    const customerNameInput = document.getElementById('customerName');
    const customerEmailInput = document.getElementById('customerEmail');
    const quoteNotesInput = document.getElementById('quoteNotes');
    const productColorSelect = document.getElementById('productColor');
    const productSizeSelect = document.getElementById('productSize');
    const addOnOptionsDiv = document.getElementById('addOnOptions');
    const typeQuantitiesList = document.getElementById('typeQuantitiesList');
    const photoUploadInput = document.getElementById('photoUpload');
    const filePreviewContainer = document.getElementById('filePreviewContainer');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const aiPromptText = document.getElementById('aiPromptText');
    const generatePreviewBtn = document.getElementById('generatePreviewBtn');
    const aiLoadingIndicator = document.getElementById('aiLoadingIndicator');
    const requestQuoteBtn = document.getElementById('requestQuoteBtn');

    // --- Firebase & State Variables ---
    const storage = firebase.storage();
    let currentProductData = null;
    let availableAddOns = {};
    let uploadedImageUrls = [];
    let isUploading = false;

    // --- Variables to hold our listener unsubscribe functions ---
    let productListener = null;
    let addOnsListener = null;
    let quotesListener = null;

    // --- Initialize EmailJS ---
    (function(){ emailjs.init({ publicKey: "AFIyvSkpq2zKuBi9r" }); })();

    // --- Application Startup Sequence ---
    function initializeApp() {
        setupProductListeners();
        setupEventListeners();
        
        auth.onAuthStateChanged(user => {
             if (user) {
                if (saveQuoteBtn) saveQuoteBtn.style.display = 'block';
                if (openOrderModalBtn) openOrderModalBtn.style.display = 'block';
                if (myQuotesSection) myQuotesSection.style.display = 'block';
                if (myQuotesList) setupQuotesListener(user.uid);
                if (customerNameInput) customerNameInput.value = user.displayName || '';
                if (customerEmailInput) customerEmailInput.value = user.email || '';
            } else {
                if (saveQuoteBtn) saveQuoteBtn.style.display = 'none';
                if (openOrderModalBtn) openOrderModalBtn.style.display = 'none';
                if (myQuotesSection) myQuotesSection.style.display = 'none';
                if (quotesListener) {
                    quotesListener();
                    quotesListener = null;
                }
                if (myQuotesList) myQuotesList.innerHTML = '<li>Please log in to see your saved quotes.</li>';
                if (customerNameInput) customerNameInput.value = '';
                if (customerEmailInput) customerEmailInput.value = '';
            }
        });
    }

    async function handleAiImageGeneration(event) {
        event.preventDefault();
        if (aiLoadingIndicator) aiLoadingIndicator.style.display = 'flex';
        if (generatePreviewBtn) {
            generatePreviewBtn.disabled = true;
            generatePreviewBtn.textContent = 'Generating...';
        }

        const user = auth.currentUser;
        if (!user) {
            alert("You must be logged in to generate an image.");
            if (aiLoadingIndicator) aiLoadingIndicator.style.display = 'none';
            if (generatePreviewBtn) {
                 generatePreviewBtn.disabled = false;
                 generatePreviewBtn.textContent = 'Generate 3D Product Preview';
            }
            return;
        }

        const prompt = aiPromptText.value.trim();
        if (!prompt) {
            alert("Please enter a prompt.");
            if (aiLoadingIndicator) aiLoadingIndicator.style.display = 'none';
            if (generatePreviewBtn) {
                 generatePreviewBtn.disabled = false;
                 generatePreviewBtn.textContent = 'Generate 3D Product Preview';
            }
            return;
        }

        try {
            console.log("User is authenticated, proceeding with HTTP function call.");
            const projectId = 'custom3dprintbuilder';
            const region = 'us-central1';
            const functionName = 'generateAiImageHttp';
            const route = 'generateAiImage';

            const apiUrl = new URL(`https://${region}-${projectId}.cloudfunctions.net/${functionName}/${route}`);
            apiUrl.searchParams.append('prompt', prompt);
            const idToken = await user.getIdToken();

            const response = await fetch(apiUrl.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + idToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            const imageUrl = result.imageUrl;

            if (imageUrl && productImage) {
                productImage.src = imageUrl;
                if(requestQuoteBtn) requestQuoteBtn.style.display = 'block';
                productImage.alt = "AI Generated Product Image";
            } else {
                 throw new Error("Received an invalid image URL from the server.");
            }

        } catch (error) {
            console.error("Error calling generateAiImageHttp function:", error);
            alert(`Error generating image: ${error.message}`);
            if (productImage) {
                productImage.alt = "Error loading image";
            }
        } finally {
            if (aiLoadingIndicator) aiLoadingIndicator.style.display = 'none';
            if (generatePreviewBtn) {
                generatePreviewBtn.disabled = false;
                generatePreviewBtn.textContent = 'Generate 3D Product Preview';
            }
        }
    }

    // --- Real-time Data Listeners ---
    function setupProductListeners() {
        const productId = currentProductIdInput.value;
        if (!productId) { return; }

        if (productListener) productListener();
        if (addOnsListener) addOnsListener();

        productListener = db.collection('products').doc(productId).onSnapshot(productDoc => {
            console.log("Product data updated in real-time for:", productId);
            if (!productDoc.exists) { 
                if (productId === 'ai-generator') {
                    calculateQuote();
                }
                return; 
            }

            currentProductData = productDoc.data();
            if (currentProductData.defaultImage && productImage) {
                if (!productImage.src.includes('generated')) { 
                    productImage.src = currentProductData.defaultImage;
                 }
            }

            const createConfigRow = (container, item) => {
                const itemDiv = document.createElement('div');
                itemDiv.classList.add('config-item-row');
                const labelWrapper = document.createElement('div');
                labelWrapper.classList.add('label-wrapper');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = item.checkId;
                checkbox.dataset.id = item.id;
                checkbox.classList.add('item-checkbox');
                const label = document.createElement('label');
                label.htmlFor = item.checkId;
                label.textContent = item.name;
                const qtyInput = document.createElement('input');
                qtyInput.type = 'number';
                qtyInput.min = 1;
                qtyInput.value = 1;
                qtyInput.id = item.qtyId;
                qtyInput.classList.add('quantity-input');
                qtyInput.dataset.id = item.id;
                qtyInput.style.display = 'none';
                checkbox.addEventListener('change', () => {
                    qtyInput.style.display = checkbox.checked ? 'inline-block' : 'none';
                    updatePreviewImage();
                    calculateQuote();
                });
                qtyInput.addEventListener('input', calculateQuote);
                labelWrapper.appendChild(checkbox);
                labelWrapper.appendChild(label);
                itemDiv.appendChild(labelWrapper);
                itemDiv.appendChild(qtyInput);
                container.appendChild(itemDiv);
            };

            if (productId === 'bufo') {
                if(productColorSelect) {
                    productColorSelect.innerHTML = '';
                    currentProductData.availableColors.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c.charAt(0).toUpperCase() + c.slice(1); productColorSelect.appendChild(o); });
                }
                if(productSizeSelect) {
                    productSizeSelect.innerHTML = '';
                    currentProductData.availableSizes.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; productSizeSelect.appendChild(o); });
                }

                addOnsListener = db.collection('addOns').onSnapshot(addOnSnapshot => {
                    const preservedState = {};
                    if (addOnOptionsDiv) {
                        addOnOptionsDiv.querySelectorAll('.item-checkbox').forEach(checkbox => {
                            const addOnId = checkbox.dataset.id;
                            const qtyInput = document.getElementById(`qty-addon-${addOnId}`);
                            if (checkbox.checked && qtyInput) {
                                preservedState[addOnId] = {
                                    checked: true,
                                    quantity: qtyInput.value
                                };
                            }
                        });
                    }

                    if (addOnOptionsDiv) addOnOptionsDiv.innerHTML = '';
                    availableAddOns = {}; 
                    addOnSnapshot.forEach(doc => {
                        availableAddOns[doc.id] = doc.data();
                        createConfigRow(addOnOptionsDiv, { id: doc.id, name: doc.data().name, checkId: `addon-check-${doc.id}`, qtyId: `qty-addon-${doc.id}` });
                        
                        if (preservedState[doc.id]) {
                            const newCheckbox = document.getElementById(`addon-check-${doc.id}`);
                            const newQtyInput = document.getElementById(`qty-addon-${doc.id}`);
                            if (newCheckbox && newQtyInput) {
                                newCheckbox.checked = true;
                                newQtyInput.value = preservedState[doc.id].quantity;
                                newQtyInput.style.display = 'inline-block';
                            }
                        }
                    });
                    
                    calculateQuote();
                });

            } else if (productId === 'cartoon-charm' || productId === 'team-swag') {
                if (typeQuantitiesList) {
                    const preservedState = {};
                    typeQuantitiesList.querySelectorAll('.item-checkbox').forEach(checkbox => {
                        const typeId = checkbox.dataset.id;
                        const qtyInput = document.querySelector(`.quantity-input[data-id="${typeId}"]`);
                        if (checkbox.checked && qtyInput) {
                            preservedState[typeId] = {
                                checked: true,
                                quantity: qtyInput.value
                            };
                        }
                    });

                    typeQuantitiesList.innerHTML = '';
                    currentProductData.availableTypes.forEach(type => {
                        const typeIdSafe = type.replace(/\s+/g, '-');
                        createConfigRow(typeQuantitiesList, { id: type, name: type, checkId: `type-check-${typeIdSafe}`, qtyId: `qty-type-${typeIdSafe}` });
                        
                        if (preservedState[type]) {
                            const newCheckbox = document.getElementById(`type-check-${typeIdSafe}`);
                            const newQtyInput = document.getElementById(`qty-type-${typeIdSafe}`);
                            if (newCheckbox && newQtyInput) {
                                newCheckbox.checked = true;
                                newQtyInput.value = preservedState[type].quantity;
                                newQtyInput.style.display = 'inline-block';
                            }
                        }
                    });
                }
                if (designFeeSpan && typeof currentProductData.designFee === 'number') {
                    const feePara = designFeeSpan.parentElement;
                    if(feePara) feePara.style.display = 'block';
                    designFeeSpan.textContent = currentProductData.designFee.toFixed(2);
                }
            }

            updatePreviewImage();
            calculateQuote();
        }, error => {
            console.error("Error listening to product data:", error);
        });
    }

    function setupQuotesListener(userId) {
        const productId = currentProductIdInput.value;
        if (!myQuotesList) return;

        if (quotesListener) quotesListener();

        const query = db.collection('quotes')
            .where('userId', '==', userId)
            .where('productId', '==', productId)
            .orderBy('timestamp', 'desc');

        myQuotesList.innerHTML = '<li>Loading history...</li>';

        quotesListener = query.onSnapshot(snapshot => {
            myQuotesList.innerHTML = ''; 
            if (snapshot.empty) {
                myQuotesList.innerHTML = `<li>You have no saved quotes for this product.</li>`;
                return;
            }
            snapshot.forEach(doc => {
                const quote = doc.data();
                const li = document.createElement('li');
                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('quote-details');
                let dateTimeDisplay = 'N/A';
                if (quote.timestamp) { const date = new Date(quote.timestamp.toDate()); const timeOptions = { hour: 'numeric', minute: '2-digit' }; dateTimeDisplay = `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], timeOptions)}`; }
                let detailsHtml = `<strong>${quote.productName} - $${quote.totalCost.toFixed(2)}</strong><br>`;
                if (quote.productId === 'bufo') {
                    const addOnsText = quote.selectedAddOns?.map(item => `${availableAddOns[item.id]?.name || item.id} (x${item.quantity})`).join(', ') || 'None';
                    detailsHtml += `<small>Color: ${quote.color}, Size: ${quote.size}, Qty: ${quote.quantity}</small><br><small>Add-Ons: ${addOnsText}</small><br>`;
                } else if (productId === 'cartoon-charm' || productId === 'team-swag') {
                    const itemsText = quote.items?.map(item => `${item.type} (x${item.quantity})`).join(', ') || 'None';
                    detailsHtml += `<small>Items: ${itemsText}</small><br>`;
                }
                detailsHtml += `<small>Saved on: ${dateTimeDisplay}</small>`;
                detailsDiv.innerHTML = detailsHtml;
                const actionsDiv = document.createElement('div');
                actionsDiv.classList.add('quote-actions');
                const orderBtn = document.createElement('button');
                orderBtn.textContent = 'Order';
                orderBtn.classList.add('quote-order-btn');
                orderBtn.dataset.quote = JSON.stringify(quote);
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.classList.add('quote-delete-btn');
                deleteBtn.dataset.id = doc.id;
                actionsDiv.appendChild(orderBtn);
                actionsDiv.appendChild(deleteBtn);
                li.appendChild(detailsDiv);
                li.appendChild(actionsDiv);
                myQuotesList.appendChild(li);
            });
        }, error => {
            console.error("Error listening to saved quotes:", error);
            myQuotesList.innerHTML = '<li>Error loading history. Check console for details.</li>';
        });
    }

    function calculateQuote() {
        const productId = currentProductIdInput.value;
        let totalCost = 0, totalMaterial = 0, totalTime = 0;

        if (!currentProductData && productId !== 'ai-generator') return;

        if (productId === 'bufo') {
            const quantity = parseInt(productQuantityInput.value) || 1;
            const selectedSize = productSizeSelect.value;
            const sizeMultiplier = currentProductData.sizeMultipliers[selectedSize] || 1.0;
            totalCost = (currentProductData.basePrice * sizeMultiplier) * quantity;
            totalMaterial = (currentProductData.defaultMaterialGrams || 0) * sizeMultiplier * quantity;
            totalTime = (currentProductData.defaultPrintTimeMinutes || 0) * sizeMultiplier * quantity;
            document.querySelectorAll('#addOnOptions .item-checkbox:checked').forEach(checkbox => {
                const addOnId = checkbox.dataset.id;
                const addOnData = availableAddOns[addOnId];
                const addOnQtyInput = document.querySelector(`.quantity-input[data-id="${addOnId}"]`);
                const addOnQty = parseInt(addOnQtyInput.value) || 0;
                if (addOnData && addOnQty > 0) {
                    totalCost += (addOnData.price || 0) * addOnQty;
                    totalMaterial += (addOnData.materialGrams || 0) * addOnQty;
                    totalTime += (addOnData.printTimeMinutes || 0) * addOnQty;
                }
            });
        } else if (productId === 'cartoon-charm' || productId === 'team-swag') {
            let totalItems = 0;
            document.querySelectorAll('#typeQuantitiesList .item-checkbox:checked').forEach(checkbox => {
                const type = checkbox.dataset.id;
                const qtyInput = document.querySelector(`.quantity-input[data-id="${type}"]`);
                const quantity = parseInt(qtyInput.value) || 0;
                if (quantity > 0) {
                    totalItems += quantity;
                    const typeDetails = currentProductData.typeDetails[type];
                    if (typeDetails) {
                        totalCost += typeDetails.price * quantity;
                        totalMaterial += typeDetails.materialGrams * quantity;
                        totalTime += typeDetails.printTimeMinutes * quantity;
                    }
                }
            });
            if (totalItems > 0 && typeof currentProductData.designFee === 'number') {
                totalCost += currentProductData.designFee;
            }
        } else if (productId === 'ai-generator') {
            totalCost = 30;
        }

        if(materialUsageSpan) materialUsageSpan.textContent = totalMaterial.toFixed(2);
        if(printTimeSpan) printTimeSpan.textContent = totalTime.toFixed(0);
        if(estimatedCostSpan) estimatedCostSpan.textContent = totalCost.toFixed(2);
    }
    
    function setupEventListeners() {
        if (saveQuoteBtn) saveQuoteBtn.addEventListener('click', saveQuote);
        if (myQuotesList) myQuotesList.addEventListener('click', handleQuoteAction);
        if (openOrderModalBtn) openOrderModalBtn.addEventListener('click', () => { if(orderModal) orderModal.style.display = 'flex'; });
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => { if(orderModal) orderModal.style.display = 'none'; });
        window.addEventListener('click', (event) => { if (event.target === orderModal) { orderModal.style.display = 'none'; } });
        if (orderForm) orderForm.addEventListener('submit', handleOrderSubmit);
        if (productQuantityInput) productQuantityInput.addEventListener('input', calculateQuote);
        if (productColorSelect) { productColorSelect.addEventListener('change', () => { updatePreviewImage(); calculateQuote(); }); }
        if (productSizeSelect) { productSizeSelect.addEventListener('change', calculateQuote); }
        if (photoUploadInput) { photoUploadInput.addEventListener('change', handleFileSelection); }
        if (generatePreviewBtn) {
            generatePreviewBtn.addEventListener('click', handleAiImageGeneration);
        }
        if (requestQuoteBtn) {
            requestQuoteBtn.addEventListener('click', () => {
                if (orderModal) {
                    // FIX: Populate the new preview elements in the modal
                    if (currentProductIdInput.value === 'ai-generator') {
                        const modalPreviewImage = document.getElementById('modalPreviewImage');
                        const modalPromptText = document.getElementById('modalPromptText');

                        if (modalPreviewImage) modalPreviewImage.src = productImage.src;
                        if (modalPromptText) modalPromptText.textContent = aiPromptText.value;
                        
                        // Clear the notes field for user input
                        if (quoteNotesInput) quoteNotesInput.value = ''; 
                    }
                    orderModal.style.display = 'flex';
                }
            });
        }
    }
    
    function updatePreviewImage() {
        const productId = currentProductIdInput.value;
        if (!currentProductData && productId !== 'ai-generator') return;

        if (productId === 'bufo') {
            if (!productColorSelect || !currentProductData.imageMap) return;
            const selectedColor = productColorSelect.value;
            const firstCheckedAddon = document.querySelector('#addOnOptions .item-checkbox:checked');
            const addOnId = firstCheckedAddon ? firstCheckedAddon.dataset.id : 'none';
            const affectsImageKey = availableAddOns[addOnId]?.affectsImageKey;
            const imageKey = affectsImageKey ? `${affectsImageKey}` : 'plain_green';
            if(productImage) productImage.src = currentProductData.imageMap[imageKey] || currentProductData.imageMap['plain_green'] || 'placeholder.jpg';
        } else if (productId === 'cartoon-charm' || productId === 'team-swag') {
            const firstCheckedType = document.querySelector('#typeQuantitiesList .item-checkbox:checked');
            if (firstCheckedType) {
                const type = firstCheckedType.dataset.id;
                const imageUrl = currentProductData.typeDetails[type]?.imageUrl;
                if (imageUrl && productImage) productImage.src = imageUrl;
            } else {
                if(currentProductData.defaultImage && productImage) productImage.src = currentProductData.defaultImage;
            }
        }
    }
    
    function handleFileSelection(event) {
        const files = event.target.files;
        if (!files.length) { if(fileNameDisplay) fileNameDisplay.textContent = 'No file chosen'; return; }
        if (files.length > 5) { alert("You can upload a maximum of 5 files."); photoUploadInput.value = ''; if(fileNameDisplay) fileNameDisplay.textContent = 'No file chosen'; return; }
        if(fileNameDisplay) fileNameDisplay.textContent = files.length === 1 ? files[0].name : `${files.length} files selected`;
        if(filePreviewContainer) filePreviewContainer.innerHTML = '';
        uploadedImageUrls = [];
        isUploading = true;
        const submitBtn = orderForm.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Uploading...'; }
        const uploadPromises = Array.from(files).map(file => {
            const fileId = `file-${Math.random().toString(36).substr(2, 9)}`;
            const previewEl = document.createElement('div');
            previewEl.classList.add('file-preview-item');
            previewEl.id = fileId;
            previewEl.innerHTML = `<span class="file-name">${file.name}</span><span class="file-status">Uploading (0%)...</span>`;
            if(filePreviewContainer) filePreviewContainer.appendChild(previewEl);
            return uploadFile(file, fileId);
        });
        Promise.all(uploadPromises).then(() => {
            isUploading = false;
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'LGTM! Order it!'; }
        }).catch(error => {
            isUploading = false;
            alert("An error occurred during file upload. Please try again.");
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'LGTM! Order it!'; }
        });
    }

    function uploadFile(file, elementId) {
        return new Promise((resolve, reject) => {
            const user = firebase.auth().currentUser;
            if (!user) { alert("Please log in to upload photos."); return reject("User not logged in"); }
            const filePath = `uploads/${user.uid}/${Date.now()}-${file.name}`;
            const storageRef = storage.ref(filePath);
            const uploadTask = storageRef.put(file);
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    const statusEl = document.querySelector(`#${elementId} .file-status`);
                    if (statusEl) statusEl.textContent = `Uploading (${Math.round(progress)}%)...`;
                }, (error) => {
                    const statusEl = document.querySelector(`#${elementId} .file-status`);
                    if (statusEl) statusEl.textContent = 'Upload Failed!';
                    reject(error);
                }, () => {
                    uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                        const statusEl = document.querySelector(`#${elementId} .file-status`);
                        if (statusEl) statusEl.textContent = 'Uploaded ✔';
                        uploadedImageUrls.push(downloadURL);
                        resolve(downloadURL);
                    });
                }
            );
        });
    }

    async function saveQuote() {
        const user = auth.currentUser;
        if (!user) { alert("You must be logged in to save a quote."); return; }
        const productId = currentProductIdInput.value;
        let quoteData = {
            userId: user.uid,
            productId: productId,
            productName: currentProductData.name,
            totalCost: parseFloat(estimatedCostSpan.textContent),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (productId === 'bufo') {
            const selectedAddOns = [];
            document.querySelectorAll('#addOnOptions .item-checkbox:checked').forEach(checkbox => {
                const addOnId = checkbox.dataset.id;
                const qtyInput = document.querySelector(`.quantity-input[data-id="${addOnId}"]`);
                selectedAddOns.push({ id: addOnId, quantity: parseInt(qtyInput.value) || 1 });
            });
            quoteData.color = productColorSelect.value;
            quoteData.size = productSizeSelect.value;
            quoteData.quantity = parseInt(productQuantityInput.value, 10);
            quoteData.selectedAddOns = selectedAddOns;
        } else if (productId === 'cartoon-charm' || productId === 'team-swag') {
            const items = [];
            document.querySelectorAll('#typeQuantitiesList .item-checkbox:checked').forEach(checkbox => {
                const type = checkbox.dataset.id;
                const qtyInput = document.querySelector(`.quantity-input[data-id="${type}"]`);
                items.push({ type: type, quantity: parseInt(qtyInput.value) || 1 });
            });
            if (items.length === 0) { alert("Please select at least one item type to save a quote."); return; }
            quoteData.items = items;
        }
        try {
            await db.collection('quotes').add(quoteData);
            alert("Quote saved successfully!");
        } catch (error) { console.error("Error saving quote: ", error); alert("Error saving quote."); }
    }
    
    function handleQuoteAction(event) {
        const target = event.target;
        if (target.classList.contains('quote-delete-btn')) {
            const quoteId = target.dataset.id;
            if (confirm("Are you sure you want to delete this quote?")) { deleteQuote(quoteId); }
        } else if (target.classList.contains('quote-order-btn')) {
            const quoteData = JSON.parse(target.dataset.quote);
            if (quoteData.productId !== currentProductIdInput.value) { alert(`This quote is for the '${quoteData.productName}' product. Please go to that product's page to place the order.`); return; }
            populateFormFromQuote(quoteData);
        }
    }

    async function deleteQuote(quoteId) {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await db.collection('quotes').doc(quoteId).delete();
        } catch (error) { console.error("Error deleting quote:", error); alert("Failed to delete quote."); }
    }

    function populateFormFromQuote(quote) {
        const productId = quote.productId;
        if (productId === 'bufo') {
            productColorSelect.value = quote.color;
            productSizeSelect.value = quote.size;
            productQuantityInput.value = quote.quantity;
            document.querySelectorAll('#addOnOptions .item-checkbox').forEach(cb => cb.checked = false);
            document.querySelectorAll('#addOnOptions .quantity-input').forEach(inp => inp.style.display = 'none');
            quote.selectedAddOns?.forEach(item => {
                const checkbox = document.getElementById(`addon-check-${item.id}`);
                const qtyInput = document.querySelector(`.quantity-input[data-id="${item.id}"]`);
                if (checkbox && qtyInput) {
                    checkbox.checked = true;
                    qtyInput.value = item.quantity;
                    qtyInput.style.display = 'inline-block';
                }
            });
        } else if (productId === 'cartoon-charm' || productId === 'team-swag') {
            document.querySelectorAll('#typeQuantitiesList .item-checkbox').forEach(cb => cb.checked = false);
            document.querySelectorAll('#typeQuantitiesList .quantity-input').forEach(inp => { inp.value = 0; inp.style.display = 'none'; });
            quote.items?.forEach(item => {
                const checkbox = document.getElementById(`type-check-${item.type.replace(/\s+/g, '-')}`);
                const qtyInput = document.querySelector(`.quantity-input[data-id="${item.type}"]`);
                if (checkbox && qtyInput) {
                    checkbox.checked = true;
                    qtyInput.value = item.quantity;
                    qtyInput.style.display = 'inline-block';
                }
            });
        }
        calculateQuote();
        updatePreviewImage();
        if(orderModal) orderModal.style.display = 'flex';
    }
    
    async function handleOrderSubmit(e) {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        if (isUploading) { alert("Please wait for photos to finish uploading."); return; }
        const productId = currentProductIdInput.value;
        if ((productId === 'cartoon-charm' || productId === 'team-swag') && uploadedImageUrls.length === 0) {
            alert("Please upload at least one photo for your order."); 
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        
        if (!auth.currentUser) {
            alert("Please log in to place an order.");
            submitBtn.disabled = false;
            submitBtn.textContent = 'LGTM! Order it!';
            return;
        }
        
        calculateQuote();
        let orderDetailsString = '';
        let orderData = {
            productId: productId,
            productName: currentProductData?.name || 'AI Generated Character',
            totalEstimatedCost: parseFloat(estimatedCostSpan.textContent),
            customerName: customerNameInput.value.trim(),
            customerEmail: customerEmailInput.value.trim(),
            notes: quoteNotesInput.value.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: auth.currentUser.uid,
            status: 'pending'
        };

        let displayCost = `$${orderData.totalEstimatedCost.toFixed(2)}`;
        
        if (productId === 'bufo') {
            const selectedAddOns = [];
            document.querySelectorAll('#addOnOptions .item-checkbox:checked').forEach(checkbox => {
                const addOnId = checkbox.dataset.id;
                const qtyInput = document.querySelector(`.quantity-input[data-id="${addOnId}"]`);
                selectedAddOns.push({ id: addOnId, quantity: parseInt(qtyInput.value) || 1 });
            });
            orderData.selectedColor = productColorSelect.value;
            orderData.selectedSize = productSizeSelect.value;
            orderData.quantity = parseInt(productQuantityInput.value);
            orderData.selectedAddOns = selectedAddOns;
            
            const addOnsText = selectedAddOns.map(item => {
                const addOnPrice = availableAddOns[item.id]?.price || 0;
                const lineItemTotal = addOnPrice * item.quantity;
                return `${availableAddOns[item.id]?.name} (x${item.quantity}) - $${lineItemTotal.toFixed(2)}`;
            }).join('\n                ');
            const baseBufoPrice = (currentProductData.basePrice * currentProductData.sizeMultipliers[orderData.selectedSize]) * orderData.quantity;
            orderDetailsString = `
                Product: ${orderData.productName}
                - Color: ${orderData.selectedColor}
                - Size: ${orderData.selectedSize}
                - Quantity: ${orderData.quantity}
                - Base Price: $${baseBufoPrice.toFixed(2)}
                Add-Ons:
                ${addOnsText || 'None'}
            `;
        } else if (productId === 'cartoon-charm' || productId === 'team-swag') {
            const items = [];
            document.querySelectorAll('#typeQuantitiesList .item-checkbox:checked').forEach(checkbox => {
                const type = checkbox.dataset.id;
                const qtyInput = document.querySelector(`.quantity-input[data-id="${type}"]`);
                const quantity = parseInt(qtyInput.value) || 0;
                if(quantity > 0) { items.push({ type: type, quantity: quantity }); }
            });
            orderData.items = items;
            orderData.designFee = currentProductData.designFee;

            const itemsText = items.map(item => {
                const itemPrice = currentProductData.typeDetails[item.type].price;
                const lineItemTotal = itemPrice * item.quantity;
                return `${item.type} (x${item.quantity}) - $${lineItemTotal.toFixed(2)}`;
            }).join('\n                ');
            orderDetailsString = `
                Product: ${orderData.productName}
                Items:
                ${itemsText || 'None'}
                --------------------
                Design Fee: $${orderData.designFee.toFixed(2)}
            `;
        } else if (productId === 'ai-generator') {
            displayCost = '$30 - $50';
            orderData.prompt = aiPromptText.value;
            orderData.generatedImageUrl = productImage.src; 
            orderDetailsString = `
                Product: AI-Generated Custom Character
                Prompt: ${orderData.prompt}
                Generated Image: <a href="${orderData.generatedImageUrl}" target="_blank">View Image</a>
                --------------------
                Estimated Price: $30 - $50 (pending final quote)
            `;
        }
        
        if (productId === 'cartoon-charm' || productId === 'team-swag') {
            orderData.photoUrls = uploadedImageUrls;
        }
        
        try {
            await db.collection('orders').add(orderData);
            
            let photoLinksHtml = '';
            if (orderData.photoUrls && orderData.photoUrls.length > 0) {
                photoLinksHtml = '<strong>Uploaded Photo Links:</strong><br>' + orderData.photoUrls.map(url => `<a href="${url}" target="_blank">${url}</a>`).join('<br>');
            }
            
            const templateParams = {
                customer_name: orderData.customerName,
                customer_email: orderData.customerEmail,
                order_details: orderDetailsString,
                total_cost: displayCost,
                notes: orderData.notes || 'No notes provided.',
                photo_links: photoLinksHtml,
            };
            
            await emailjs.send('service_rnwve4f', 'template_5ep9p7i', templateParams);
            alert("Order placed successfully! We'll be in touch soon.");
            
            if(orderForm) orderForm.reset();
            if(filePreviewContainer) filePreviewContainer.innerHTML = '';
            uploadedImageUrls = [];
            if(orderModal) orderModal.style.display = 'none';

        } catch (error) {
            console.error("Error placing order or sending email: ", error);
            alert("Failed to place order.");
        } finally {
            if(submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'LGTM! Order it!';
            }
        }
    }

    // --- Initial data load ---
    initializeApp();
});