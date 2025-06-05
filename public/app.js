// app.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Get references to HTML elements ---
    const productImage = document.getElementById('productImage');
    const currentProductIdInput = document.getElementById('currentProductId');
    const productColorSelect = document.getElementById('productColor');
    const addOnOptionsDiv = document.getElementById('addOnOptions');
    const customTextInput = document.getElementById('customText');
    const customTextInputDiv = document.getElementById('textInput');
    const productSizeSelect = document.getElementById('productSize');
    const productQuantityInput = document.getElementById('productQuantity');
    const materialUsageSpan = document.getElementById('materialUsage');
    const printTimeSpan = document.getElementById('printTime');
    const estimatedCostSpan = document.getElementById('estimatedCost');
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

    let currentProductData = null;
    let availableAddOns = {};

    // --- NEW: Initialize EmailJS with your Public Key ---
    // Get your Public Key from the "Account" section of the EmailJS dashboard
    (function(){
        emailjs.init({
            publicKey: "AFIyvSkpq2zKuBi9r", // PASTE YOUR PUBLIC KEY HERE
        });
    })();


    // --- Application Startup Sequence ---
    async function initializeApp() {
        await loadConfigData();
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

    // --- Load Product Data (Unchanged) ---
    async function loadConfigData() { const productId = currentProductIdInput.value; if (!productId) { console.error("No product ID specified."); return; } try { const productDoc = await db.collection('products').doc(productId).get(); if (productDoc.exists) { currentProductData = productDoc.data(); productColorSelect.innerHTML = ''; currentProductData.availableColors.forEach(color => { const option = document.createElement('option'); option.value = color; option.textContent = color.charAt(0).toUpperCase() + color.slice(1); productColorSelect.appendChild(option); }); productSizeSelect.innerHTML = ''; currentProductData.availableSizes.forEach(size => { const option = document.createElement('option'); option.value = size; option.textContent = size; productSizeSelect.appendChild(option); }); const addOnSnapshot = await db.collection('addOns').get(); addOnSnapshot.forEach(doc => { availableAddOns[doc.id] = doc.data(); const addOn = doc.data(); const addOnItemDiv = document.createElement('div'); addOnItemDiv.classList.add('add-on-item'); const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'selectedAddOn'; radio.value = doc.id; radio.id = `addon-${doc.id}`; radio.dataset.affectsImageKey = addOn.affectsImageKey; const label = document.createElement('label'); label.htmlFor = `addon-${doc.id}`; label.textContent = addOn.name; addOnItemDiv.appendChild(radio); addOnItemDiv.appendChild(label); addOnOptionsDiv.appendChild(addOnItemDiv); }); const noAddOnItemDiv = document.createElement('div'); noAddOnItemDiv.classList.add('add-on-item'); const noAddOnRadio = document.createElement('input'); noAddOnRadio.type = 'radio'; noAddOnRadio.name = 'selectedAddOn'; noAddOnRadio.value = 'none'; noAddOnRadio.id = 'addon-none'; noAddOnRadio.checked = true; const noAddOnLabel = document.createElement('label'); noAddOnLabel.htmlFor = 'addon-none'; noAddOnLabel.textContent = 'None'; noAddOnItemDiv.appendChild(noAddOnRadio); noAddOnItemDiv.appendChild(noAddOnLabel); addOnOptionsDiv.prepend(noAddOnItemDiv); if (availableAddOns['custom_text']) { customTextInputDiv.style.display = 'block'; const textAddOnItemDiv = document.createElement('div'); textAddOnItemDiv.classList.add('add-on-item'); const textAddOnCheckbox = document.createElement('input'); textAddOnCheckbox.type = 'checkbox'; textAddOnCheckbox.name = 'selectedAddOnCheckbox'; textAddOnCheckbox.value = 'custom_text'; textAddOnCheckbox.id = 'addon-custom-text'; const textAddOnLabel = document.createElement('label'); textAddOnLabel.htmlFor = 'addon-custom-text'; textAddOnLabel.textContent = 'Add Custom Text (not shown on image)'; textAddOnItemDiv.appendChild(textAddOnCheckbox); textAddOnItemDiv.appendChild(textAddOnLabel); addOnOptionsDiv.appendChild(textAddOnItemDiv); textAddOnCheckbox.addEventListener('change', calculateQuote); customTextInput.addEventListener('input', calculateQuote); } updateProductImage(); calculateQuote(); } } catch (error) { console.error("Error loading config data: ", error); } }

    // --- Calculation and UI updates (Unchanged) ---
    function updateProductImage() { if (!currentProductData) return; const selectedColor = productColorSelect.value; const selectedAddOnRadio = addOnOptionsDiv.querySelector('input[name="selectedAddOn"]:checked'); const selectedAddOnValue = selectedAddOnRadio ? selectedAddOnRadio.value : 'none'; let imageKey = (selectedAddOnValue && selectedAddOnValue !== 'none' && availableAddOns[selectedAddOnValue]?.affectsImageKey) ? `${selectedAddOnValue}_${selectedColor}` : `plain_${selectedColor}`; productImage.src = currentProductData.imageMap[imageKey] || currentProductData.imageMap[`plain_${selectedColor}`] || 'placeholder.jpg'; }
    function calculateQuote() { if (!currentProductData) return; const selectedSize = productSizeSelect.value; const quantity = parseInt(productQuantityInput.value) || 1; const sizeMultiplier = currentProductData.sizeMultipliers[selectedSize] || 1.0; let totalBaseCost = currentProductData.basePrice * sizeMultiplier; let totalMaterialGrams = currentProductData.defaultMaterialGrams * sizeMultiplier; let totalPrintTimeMinutes = currentProductData.defaultPrintTimeMinutes * sizeMultiplier; const radioAddOn = addOnOptionsDiv.querySelector('input[name="selectedAddOn"]:checked'); if (radioAddOn && radioAddOn.value !== 'none') { const addOnData = availableAddOns[radioAddOn.value]; if (addOnData) { totalBaseCost += addOnData.price; totalMaterialGrams += addOnData.materialGrams; totalPrintTimeMinutes += addOnData.printTimeMinutes; } } const checkboxAddOns = addOnOptionsDiv.querySelectorAll('input[name="selectedAddOnCheckbox"]:checked'); checkboxAddOns.forEach(checkbox => { const addOnData = availableAddOns[checkbox.value]; if (addOnData) { totalBaseCost += addOnData.price; totalMaterialGrams += addOnData.materialGrams; totalPrintTimeMinutes += addOnData.printTimeMinutes; } }); materialUsageSpan.textContent = (totalMaterialGrams * quantity).toFixed(2); printTimeSpan.textContent = (totalPrintTimeMinutes * quantity).toFixed(0); estimatedCostSpan.textContent = (totalBaseCost * quantity).toFixed(2); }

    // --- Event Listeners (Unchanged) ---
    productColorSelect.addEventListener('change', () => { updateProductImage(); calculateQuote(); });
    productSizeSelect.addEventListener('change', calculateQuote);
    productQuantityInput.addEventListener('input', calculateQuote);
    addOnOptionsDiv.addEventListener('change', calculateQuote);
    saveQuoteBtn.addEventListener('click', saveQuote);
    myQuotesList.addEventListener('click', handleQuoteAction);
    openOrderModalBtn.addEventListener('click', () => { orderModal.style.display = 'flex'; });
    closeModalBtn.addEventListener('click', () => { orderModal.style.display = 'none'; });
    window.addEventListener('click', (event) => { if (event.target === orderModal) { orderModal.style.display = 'none'; } });

    // --- Save Quote Functionality (Unchanged) ---
    async function saveQuote() { const user = auth.currentUser; if (!user) { alert("You must be logged in to save a quote."); return; } const quoteData = { userId: user.uid, productId: currentProductIdInput.value, productName: currentProductData.name || "Product", color: productColorSelect.value, size: productSizeSelect.value, quantity: parseInt(productQuantityInput.value, 10), addOn: document.querySelector('input[name="selectedAddOn"]:checked')?.value || 'none', customText: document.querySelector('#addon-custom-text:checked') ? customTextInput.value : '', totalCost: parseFloat(estimatedCostSpan.textContent), timestamp: firebase.firestore.FieldValue.serverTimestamp() }; try { await db.collection('quotes').add(quoteData); alert("Quote saved successfully!"); loadSavedQuotes(user.uid); } catch (error) { console.error("Error saving quote: ", error); alert("Error saving quote."); } }
    
    // --- Load Saved Quotes (Unchanged) ---
    async function loadSavedQuotes(userId) { myQuotesList.innerHTML = '<li>Loading history...</li>'; try { const snapshot = await db.collection('quotes').where('userId', '==', userId).orderBy('timestamp', 'desc').get(); myQuotesList.innerHTML = ''; if (snapshot.empty) { myQuotesList.innerHTML = '<li>You have no saved quotes.</li>'; return; } snapshot.forEach(doc => { const quote = doc.data(); const quoteId = doc.id; const li = document.createElement('li'); const detailsDiv = document.createElement('div'); detailsDiv.classList.add('quote-details'); let dateTimeDisplay = 'N/A'; if (quote.timestamp) { const date = new Date(quote.timestamp.toDate()); const timeOptions = { hour: 'numeric', minute: '2-digit' }; dateTimeDisplay = `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], timeOptions)}`; } let addOnDisplay = 'None'; if (quote.addOn && quote.addOn !== 'none' && availableAddOns[quote.addOn]) { addOnDisplay = availableAddOns[quote.addOn].name; } if (quote.customText) { if (addOnDisplay !== 'None') { addOnDisplay += ` + Custom Text`; } else { addOnDisplay = 'Custom Text'; } } detailsDiv.innerHTML = `<strong>${quote.productName} - $${quote.totalCost.toFixed(2)}</strong><br><small>Color: ${quote.color}, Size: ${quote.size}, Qty: ${quote.quantity}</small><br><small>Add-On: ${addOnDisplay}</small><br><small>Saved on: ${dateTimeDisplay}</small>`; const actionsDiv = document.createElement('div'); actionsDiv.classList.add('quote-actions'); const orderBtn = document.createElement('button'); orderBtn.textContent = 'Order'; orderBtn.classList.add('quote-order-btn'); orderBtn.dataset.quote = JSON.stringify(quote); const deleteBtn = document.createElement('button'); deleteBtn.textContent = 'Delete'; deleteBtn.classList.add('quote-delete-btn'); deleteBtn.dataset.id = quoteId; actionsDiv.appendChild(orderBtn); actionsDiv.appendChild(deleteBtn); li.appendChild(detailsDiv); li.appendChild(actionsDiv); myQuotesList.appendChild(li); }); } catch (error) { console.error("Error loading saved quotes:", error); myQuotesList.innerHTML = '<li>Error loading history.</li>'; } }

    // --- Action Handler and Helper Functions (Unchanged) ---
    function handleQuoteAction(event) { const target = event.target; if (target.classList.contains('quote-delete-btn')) { const quoteId = target.dataset.id; if (confirm("Are you sure you want to delete this quote?")) { deleteQuote(quoteId); } } else if (target.classList.contains('quote-order-btn')) { const quoteData = JSON.parse(target.dataset.quote); populateFormFromQuote(quoteData); } }
    async function deleteQuote(quoteId) { const user = auth.currentUser; if (!user) return; try { await db.collection('quotes').doc(quoteId).delete(); loadSavedQuotes(user.uid); } catch (error) { console.error("Error deleting quote:", error); alert("Failed to delete quote."); } }
    function populateFormFromQuote(quote) { productColorSelect.value = quote.color; productSizeSelect.value = quote.size; productQuantityInput.value = quote.quantity; const addOnRadio = document.querySelector(`input[name="selectedAddOn"]:checked`); if (addOnRadio) { addOnRadio.checked = true; } const customTextCheckbox = document.querySelector('#addon-custom-text'); if (quote.customText && customTextCheckbox) { customTextCheckbox.checked = true; customTextInput.value = quote.customText; } else if (customTextCheckbox) { customTextCheckbox.checked = false; customTextInput.value = ''; } calculateQuote(); updateProductImage(); orderModal.style.display = 'flex'; }
    

    // --- UPDATED: Order Submission Logic to Send Email ---
    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true; // Prevent multiple clicks
        submitBtn.textContent = 'Submitting...';

        if (!auth.currentUser) {
            alert("Please log in to place an order.");
            submitBtn.disabled = false;
            submitBtn.textContent = 'LGTM! Order it!';
            return;
        }

        // --- 1. Save order to Firestore (existing logic) ---
        calculateQuote();
        const selectedAddOnsList = [];
        const radioAddOn = addOnOptionsDiv.querySelector('input[name="selectedAddOn"]:checked');
        if (radioAddOn && radioAddOn.value !== 'none') selectedAddOnsList.push(radioAddOn.value);
        addOnOptionsDiv.querySelectorAll('input[name="selectedAddOnCheckbox"]:checked').forEach(cb => selectedAddOnsList.push(cb.value));

        const orderData = {
            // ... (your existing orderData object)
            productId: currentProductIdInput.value, productName: currentProductData.name, selectedColor: productColorSelect.value, selectedSize: productSizeSelect.value, quantity: parseInt(productQuantityInput.value) || 1, selectedAddOns: selectedAddOnsList, customTextContent: selectedAddOnsList.includes('custom_text') ? customTextInput.value.trim() : '', totalEstimatedCost: parseFloat(estimatedCostSpan.textContent), totalEstimatedMaterialGrams: parseFloat(materialUsageSpan.textContent), totalEstimatedPrintTimeMinutes: parseFloat(printTimeSpan.textContent), customerName: customerNameInput.value.trim(), customerEmail: customerEmailInput.value.trim(), notes: quoteNotesInput.value.trim(), createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: auth.currentUser.uid, status: 'pending'
        };

        try {
            await db.collection('orders').add(orderData);
            
            // --- 2. Send Email Notification using EmailJS ---
            const addOnNames = orderData.selectedAddOns.map(id => availableAddOns[id]?.name || id).join(', ') || 'None';
            const orderDetailsString = `
                Product: ${orderData.productName}
                Color: ${orderData.selectedColor}
                Size: ${orderData.selectedSize}
                Quantity: ${orderData.quantity}
                Add-Ons: ${addOnNames}
                Custom Text: ${orderData.customTextContent || 'N/A'}
                ------------------------------
                Estimated Cost: $${orderData.totalEstimatedCost.toFixed(2)}
            `;

            const templateParams = {
                customer_name: orderData.customerName,
                customer_email: orderData.customerEmail,
                order_details: orderDetailsString,
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
            submitBtn.disabled = false; // Re-enable button
            submitBtn.textContent = 'LGTM! Order it!';
        }
    });

    // --- Initial data load ---
    initializeApp();
});