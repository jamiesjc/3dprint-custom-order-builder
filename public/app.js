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

    let currentProductData = null;
    let availableAddOns = {};

    // --- Initialize EmailJS ---
    (function(){ emailjs.init({ publicKey: "AFIyvSkpq2zKuBi9r" }); })();

    // --- Application Startup Sequence ---
    async function initializeApp() {
        await loadConfigData();
        setupEventListeners();
        auth.onAuthStateChanged(user => {
            if (user) {
                saveQuoteBtn.style.display = 'block'; openOrderModalBtn.style.display = 'block'; myQuotesSection.style.display = 'block';
                loadSavedQuotes(user.uid);
                customerNameInput.value = user.displayName || ''; customerEmailInput.value = user.email || '';
            } else {
                saveQuoteBtn.style.display = 'none'; openOrderModalBtn.style.display = 'none'; myQuotesSection.style.display = 'none';
                myQuotesList.innerHTML = ''; customerNameInput.value = ''; customerEmailInput.value = '';
            }
        });
    }

     // --- Load Product Data (CORRECTED) ---
    async function loadConfigData() {
        const productId = currentProductIdInput.value;
        if (!productId) { return; }
        
        try {
            const productDoc = await db.collection('products').doc(productId).get();
            if (!productDoc.exists) { return; }
            
            currentProductData = productDoc.data();
            
            if (currentProductData.defaultImage) { productImage.src = currentProductData.defaultImage; }

            if (productId === 'bufo') {
                productColorSelect.innerHTML = '';
                currentProductData.availableColors.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c.charAt(0).toUpperCase() + c.slice(1); productColorSelect.appendChild(o); });
                productSizeSelect.innerHTML = '';
                currentProductData.availableSizes.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; productSizeSelect.appendChild(o); });

                const addOnSnapshot = await db.collection('addOns').get();
                if (addOnOptionsDiv) addOnOptionsDiv.innerHTML = '';
                
                addOnSnapshot.forEach(doc => {
                    availableAddOns[doc.id] = doc.data();
                    const addOn = doc.data();
                    
                    const itemDiv = document.createElement('div');
                    itemDiv.classList.add('config-item-row'); // Use generic class

                    const labelWrapper = document.createElement('div');
                    labelWrapper.classList.add('label-wrapper'); // Use generic class

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `addon-check-${doc.id}`;
                    checkbox.dataset.addonId = doc.id;
                    checkbox.classList.add('item-checkbox'); // Use generic class
                    
                    const label = document.createElement('label');
                    label.htmlFor = checkbox.id;
                    label.textContent = addOn.name;

                    const qtyInput = document.createElement('input');
                    qtyInput.type = 'number';
                    qtyInput.min = 1;
                    qtyInput.value = 1;
                    qtyInput.id = `qty-addon-${doc.id}`;
                    qtyInput.classList.add('quantity-input'); // Use generic class
                    qtyInput.dataset.addonId = doc.id;
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
                    if (addOnOptionsDiv) addOnOptionsDiv.appendChild(itemDiv);
                });

            } else if (productId === 'cartoon-charm') {
                if (typeQuantitiesList) {
                    typeQuantitiesList.innerHTML = '';
                    currentProductData.availableTypes.forEach(type => {
                        const itemDiv = document.createElement('div');
                        itemDiv.classList.add('config-item-row'); // Use generic class
                        const labelWrapper = document.createElement('div');
                        labelWrapper.classList.add('label-wrapper'); // Use generic class
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.id = `type-check-${type.replace(/\s+/g, '-')}`;
                        checkbox.dataset.type = type;
                        checkbox.classList.add('item-checkbox'); // Use generic class
                        const label = document.createElement('label');
                        label.htmlFor = checkbox.id;
                        label.textContent = type;
                        const qtyInput = document.createElement('input');
                        qtyInput.type = 'number';
                        qtyInput.min = 1;
                        qtyInput.value = 1;
                        qtyInput.id = `qty-type-${type.replace(/\s+/g, '-')}`;
                        qtyInput.classList.add('quantity-input'); // Use generic class
                        qtyInput.dataset.type = type;
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
                        typeQuantitiesList.appendChild(itemDiv);
                    });
                }
                if (designFeeSpan && typeof currentProductData.designFee === 'number') {
                    designFeeSpan.textContent = currentProductData.designFee.toFixed(2);
                }
            }
            updatePreviewImage();
            calculateQuote();
        } catch (error) { console.error("Error loading config data:", error); }
    }

    // --- Calculation Logic (CORRECTED) ---
    function calculateQuote() {
        if (!currentProductData) return;
        const productId = currentProductIdInput.value;
        let totalCost = 0;
        let totalMaterial = 0;
        let totalTime = 0;

        if (productId === 'bufo') {
            const quantity = parseInt(productQuantityInput.value) || 1;
            const selectedSize = productSizeSelect.value;
            const sizeMultiplier = currentProductData.sizeMultipliers[selectedSize] || 1.0;
            let baseBufoCost = currentProductData.basePrice * sizeMultiplier;
            totalCost = baseBufoCost * quantity;
            totalMaterial = (currentProductData.defaultMaterialGrams || 0) * sizeMultiplier * quantity;
            totalTime = (currentProductData.defaultPrintTimeMinutes || 0) * sizeMultiplier * quantity;
            
            document.querySelectorAll('#addOnOptions .item-checkbox:checked').forEach(checkbox => {
                const addOnId = checkbox.dataset.addonId;
                const addOnData = availableAddOns[addOnId];
                const addOnQtyInput = document.querySelector(`.quantity-input[data-addon-id="${addOnId}"]`);
                const addOnQty = parseInt(addOnQtyInput.value) || 0;
                if (addOnData && addOnQty > 0) {
                    totalCost += (addOnData.price || 0) * addOnQty;
                    totalMaterial += (addOnData.materialGrams || 0) * addOnQty;
                    totalTime += (addOnData.printTimeMinutes || 0) * addOnQty;
                }
            });
        } else if (productId === 'cartoon-charm') {
            let totalItems = 0;
            document.querySelectorAll('#typeQuantitiesList .item-checkbox:checked').forEach(checkbox => {
                const type = checkbox.dataset.type;
                const qtyInput = document.querySelector(`.quantity-input[data-type="${type}"]`);
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
        }
        
        if(materialUsageSpan) materialUsageSpan.textContent = totalMaterial.toFixed(2);
        if(printTimeSpan) printTimeSpan.textContent = totalTime.toFixed(0);
        if(estimatedCostSpan) estimatedCostSpan.textContent = totalCost.toFixed(2);
    }

    // --- Universal Event Listeners ---
    function setupEventListeners() {
        if (saveQuoteBtn) saveQuoteBtn.addEventListener('click', saveQuote);
        if (myQuotesList) myQuotesList.addEventListener('click', handleQuoteAction);
        if (openOrderModalBtn) openOrderModalBtn.addEventListener('click', () => { orderModal.style.display = 'flex'; });
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => { orderModal.style.display = 'none'; });
        window.addEventListener('click', (event) => { if (event.target === orderModal) { orderModal.style.display = 'none'; } });
        if (orderForm) orderForm.addEventListener('submit', handleOrderSubmit);
        if (productQuantityInput) productQuantityInput.addEventListener('input', calculateQuote);
        if (productColorSelect) { productColorSelect.addEventListener('change', () => { updatePreviewImage(); calculateQuote(); }); }
        if (productSizeSelect) { productSizeSelect.addEventListener('change', calculateQuote); }
    }

    // --- Image Update Logic (CORRECTED) ---
    function updatePreviewImage() {
        if (!currentProductData) return;
        const productId = currentProductIdInput.value;

        if (productId === 'bufo') {
            if (!productColorSelect || !currentProductData.imageMap) return;
            const selectedColor = productColorSelect.value;
            const firstCheckedAddon = document.querySelector('#addOnOptions .item-checkbox:checked');
            const addOnId = firstCheckedAddon ? firstCheckedAddon.dataset.addonId : 'none';
            const affectsImageKey = availableAddOns[addOnId]?.affectsImageKey;
            
            const imageKey = affectsImageKey ? `${affectsImageKey}` : 'plain_green';
            productImage.src = currentProductData.imageMap[imageKey] || currentProductData.imageMap['plain_green'] || 'placeholder.jpg';
        
        } else if (productId === 'cartoon-charm') {
            const firstCheckedType = document.querySelector('#typeQuantitiesList .item-checkbox:checked');
            if (firstCheckedType) {
                const type = firstCheckedType.dataset.type;
                const imageUrl = currentProductData.typeDetails[type]?.imageUrl;
                if (imageUrl) productImage.src = imageUrl;
            } else {
                productImage.src = currentProductData.defaultImage;
            }
        }
    }

    // ==========================================================
    //  START: Corrected Save Quote Function
    // ==========================================================
    async function saveQuote() {
        const user = auth.currentUser;
        if (!user) { alert("You must be logged in to save a quote."); return; }
        const productId = currentProductIdInput.value;
        
        // This object will be populated with data to save
        let quoteData = {
            userId: user.uid,
            productId: productId,
            productName: currentProductData.name,
            totalCost: parseFloat(estimatedCostSpan.textContent),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (productId === 'bufo') {
            const selectedAddOns = [];
            // Correctly query for checked add-on checkboxes
            document.querySelectorAll('#addOnOptions .item-checkbox:checked').forEach(checkbox => {
                const addOnId = checkbox.dataset.addonId;
                const qtyInput = document.querySelector(`.quantity-input[data-addon-id="${addOnId}"]`);
                selectedAddOns.push({ id: addOnId, quantity: parseInt(qtyInput.value) || 1 });
            });
            quoteData.color = productColorSelect.value;
            quoteData.size = productSizeSelect.value;
            quoteData.quantity = parseInt(productQuantityInput.value, 10);
            quoteData.selectedAddOns = selectedAddOns; // Save the array of add-ons
        } else if (productId === 'cartoon-charm') {
            const items = [];
            document.querySelectorAll('#typeQuantitiesList .quantity-input').forEach(input => {
                const quantity = parseInt(input.value) || 0;
                // Only save if the checkbox is checked (meaning the quantity input is visible)
                const checkbox = document.getElementById(`type-check-${input.dataset.type.replace(/\s+/g, '-')}`);
                if (quantity > 0 && checkbox.checked) {
                    items.push({ type: input.dataset.type, quantity: quantity });
                }
            });
            if (items.length === 0) { alert("Please select a quantity for at least one item to save a quote."); return; }
            quoteData.items = items;
        }

        try {
            await db.collection('quotes').add(quoteData);
            alert("Quote saved successfully!");
            loadSavedQuotes(user.uid);
        } catch (error) { console.error("Error saving quote: ", error); alert("Error saving quote."); }
    }
    
    // ==========================================================
    //  START: Corrected Load Saved Quotes Function
    // ==========================================================
    async function loadSavedQuotes(userId) {
        const productId = currentProductIdInput.value;
        if (!myQuotesList) return; // Exit if the quote list isn't on the page

        myQuotesList.innerHTML = '<li>Loading history...</li>';
        try {
            const snapshot = await db.collection('quotes')
                .where('userId', '==', userId)
                .where('productId', '==', productId)
                .orderBy('timestamp', 'desc')
                .get();

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
                if (quote.timestamp) {
                    const date = new Date(quote.timestamp.toDate());
                    const timeOptions = { hour: 'numeric', minute: '2-digit' };
                    dateTimeDisplay = `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], timeOptions)}`;
                }
                
                let detailsHtml = `<strong>${quote.productName} - $${quote.totalCost.toFixed(2)}</strong><br>`;

                if (quote.productId === 'bufo') {
                    // --- THIS IS THE CORRECTED LOGIC ---
                    let addOnsText = 'None';
                    // Check if selectedAddOns exists and has items
                    if (quote.selectedAddOns && quote.selectedAddOns.length > 0) {
                        addOnsText = quote.selectedAddOns.map(item => {
                            // Look up the name from the globally available object
                            const addOnName = availableAddOns[item.id]?.name || item.id; // Fallback to ID if name not found
                            return `${addOnName} (x${item.quantity})`;
                        }).join(', ');
                    }
                    detailsHtml += `<small>Color: ${quote.color}, Size: ${quote.size}, Qty: ${quote.quantity}</small><br><small>Add-Ons: ${addOnsText}</small><br>`;
                } else if (productId === 'cartoon-charm') {
                    const itemsText = quote.items.map(item => `${item.type} (x${item.quantity})`).join(', ');
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
        } catch (error) {
            console.error("Error loading saved quotes:", error);
            myQuotesList.innerHTML = '<li>Error loading history. Check console for details.</li>';
        }
    }
    // ========================================================
    //  END: Corrected Load Saved Quotes Function
    // ========================================================
    
    // --- Action Handlers and Form Population ---
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
            loadSavedQuotes(user.uid);
        } catch (error) { console.error("Error deleting quote:", error); alert("Failed to delete quote."); }
    }

    function populateFormFromQuote(quote) {
        const productId = quote.productId;
        if (productId === 'bufo') {
            productColorSelect.value = quote.color;
            productSizeSelect.value = quote.size;
            productQuantityInput.value = quote.quantity;
            document.querySelectorAll('.addon-checkbox').forEach(cb => cb.checked = false);
            document.querySelectorAll('.addon-quantity-input').forEach(inp => inp.style.display = 'none');
            quote.selectedAddOns?.forEach(item => {
                const checkbox = document.getElementById(`addon-check-${item.id}`);
                const qtyInput = document.querySelector(`.addon-quantity-input[data-addon-id="${item.id}"]`);
                if (checkbox && qtyInput) {
                    checkbox.checked = true;
                    qtyInput.value = item.quantity;
                    qtyInput.style.display = 'inline-block';
                }
            });
        } else if (productId === 'cartoon-charm') {
            document.querySelectorAll('.type-quantity-input').forEach(input => input.value = 0);
            quote.items.forEach(item => {
                const input = document.getElementById(`qty-${item.type.replace(/\s+/g, '-')}`);
                if (input) { input.value = item.quantity; }
            });
        }
        calculateQuote();
        updatePreviewImage();
        orderModal.style.display = 'flex';
    }
    
  // ==========================================================
    //  START: Updated Order Submission Function
    // ==========================================================
    async function handleOrderSubmit(e) {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        if (!auth.currentUser) {
            alert("Please log in to place an order.");
            submitBtn.disabled = false;
            submitBtn.textContent = 'LGTM! Order it!';
            return;
        }
        calculateQuote();
        const productId = currentProductIdInput.value;
        let orderDetailsString = '';

        // --- 1. Build the Order Data Object ---
        let orderData = {
            productId: productId,
            productName: currentProductData.name,
            totalEstimatedCost: parseFloat(estimatedCostSpan.textContent),
            customerName: customerNameInput.value.trim(),
            customerEmail: customerEmailInput.value.trim(),
            notes: quoteNotesInput.value.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: auth.currentUser.uid,
            status: 'pending'
        };
        
        if (productId === 'bufo') {
            const selectedAddOns = [];
            document.querySelectorAll('.addon-checkbox:checked').forEach(checkbox => {
                const addOnId = checkbox.dataset.addonId;
                const qtyInput = document.querySelector(`.addon-quantity-input[data-addon-id="${addOnId}"]`);
                selectedAddOns.push({ id: addOnId, quantity: parseInt(qtyInput.value) || 1 });
            });
            orderData.selectedColor = productColorSelect.value;
            orderData.selectedSize = productSizeSelect.value;
            orderData.quantity = parseInt(productQuantityInput.value);
            orderData.selectedAddOns = selectedAddOns;

            // --- UPDATED: More detailed email string for Bufo ---
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
        } else if (productId === 'cartoon-charm') {
            const items = [];
            document.querySelectorAll('.type-quantity-input').forEach(input => {
                const quantity = parseInt(input.value) || 0;
                if (quantity > 0) { items.push({ type: input.dataset.type, quantity: quantity }); }
            });
            orderData.items = items;
            orderData.designFee = currentProductData.designFee;

            // --- UPDATED: More detailed email string for Cartoon Charm ---
            const itemsText = items.map(item => {
                const itemPrice = currentProductData.typeDetails[item.type].price;
                const lineItemTotal = itemPrice * item.quantity;
                return `${item.type} (x${item.quantity}) - $${lineItemTotal.toFixed(2)}`;
            }).join('\n                ');
            orderDetailsString = `
                Product: ${orderData.productName}

                Items:
                ${itemsText}
                --------------------
                Design Fee: $${orderData.designFee.toFixed(2)}
            `;
        }
        
        // --- 2. Save to Firestore and Send Email ---
        try {
            await db.collection('orders').add(orderData);
            
            const templateParams = {
                customer_name: orderData.customerName,
                customer_email: orderData.customerEmail,
                order_details: orderDetailsString,
                total_cost: orderData.totalEstimatedCost.toFixed(2),
                notes: orderData.notes || 'No notes provided.'
            };
            
            await emailjs.send('service_rnwve4f', 'template_5ep9p7i', templateParams);

            alert("Order placed successfully! We'll be in touch soon.");
            orderForm.reset();
            orderModal.style.display = 'none';

        } catch (error) {
            console.error("Error placing order or sending email: ", error);
            alert("Failed to place order. Please try again.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'LGTM! Order it!';
        }
    }

    // --- Initial data load ---
    initializeApp();
});