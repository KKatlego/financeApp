// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin;

// Fetch data from backend
document.getElementById('fetchData').addEventListener('click', async () => {
    const responseDiv = document.getElementById('response');
    responseDiv.className = 'response show';
    responseDiv.textContent = 'Loading...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/data`);
        const data = await response.json();

        responseDiv.className = 'response show success';
        responseDiv.innerHTML = `
            <strong>Success!</strong><br>
            Message: ${data.message}<br>
            Timestamp: ${data.timestamp}<br>
            Server: ${data.server}
        `;
    } catch (error) {
        responseDiv.className = 'response show error';
        responseDiv.innerHTML = `<strong>Error:</strong> ${error.message}<br>Make sure the backend server is running.`;
    }
});

// Contact form submission
document.getElementById('contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formResponse = document.getElementById('formResponse');

    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        message: document.getElementById('message').value
    };

    formResponse.style.display = 'block';
    formResponse.className = 'response show';
    formResponse.textContent = 'Sending...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/contact`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            formResponse.className = 'response show success';
            formResponse.textContent = data.message;
            document.getElementById('contactForm').reset();
        } else {
            throw new Error(data.error || 'Submission failed');
        }
    } catch (error) {
        formResponse.className = 'response show error';
        formResponse.textContent = `Error: ${error.message}`;
    }
});

// Log when page loads
console.log('Frontend loaded successfully!');
console.log('API Base URL:', API_BASE_URL);
