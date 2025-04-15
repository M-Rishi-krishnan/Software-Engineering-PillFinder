# test_med_finder.py
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains

@pytest.fixture(scope="function")
def driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    
    driver = webdriver.Chrome(options=options)
    driver.implicitly_wait(20)
    driver.set_page_load_timeout(45)
    yield driver
    driver.quit()

def test_store_owner_flow(driver):
    try:
        # Frontend URL
        driver.get("https://pillfinder.onrender.com/login")
        
        # Select Owner role
        WebDriverWait(driver, 30).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Owner')]"))
        ).click()

        # Traditional login
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.NAME, "email"))
        ).send_keys("test_owner@example.com")
        
        driver.find_element(By.NAME, "password").send_keys("TestPass12345!@#")
        driver.find_element(By.XPATH, "//button[contains(text(), 'Login as Owner')]").click()

        # Store creation
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder='Store Name']"))
        ).send_keys("Test Store")
        
        driver.find_element(By.XPATH, "//input[@placeholder='Owner Name']").send_keys("Test Owner")
        driver.find_element(By.XPATH, "//input[@placeholder='Phone Number']").send_keys("9876543210")

        # Map interaction
        map_element = driver.find_element(By.CLASS_NAME, "leaflet-container")
        ActionChains(driver).move_to_element(map_element).move_by_offset(50, 50).click().perform()

        # Submit form
        driver.find_element(By.XPATH, "//button[contains(text(), 'Create Store')]").click()

        # Verify redirect to medicine page
        WebDriverWait(driver, 30).until(
            EC.url_contains("/add-medicine")
        )

    except Exception as e:
        driver.save_screenshot("store_owner_error.png")
        pytest.fail(f"Test failed: {str(e)}")

def test_customer_flow(driver):
    try:
        driver.get("https://pillfinder.onrender.com/login")
        
        # Select Customer role
        WebDriverWait(driver, 30).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Customer')]"))
        ).click()

        # Auth0 login
        WebDriverWait(driver, 20).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Login as Customer')]"))
        ).click()

        # Medicine search
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.XPATH, "//input[@placeholder='Enter medicine name...']"))
        ).send_keys("tutu")
        
        driver.find_element(By.XPATH, "//button[contains(text(), 'Apply Filters')]").click()

        # Verify results
        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.XPATH, "//td[contains(text(), 'Paracetamol')]"))
        )

    except Exception as e:
        driver.save_screenshot("customer_error.png")
        pytest.fail(f"Test failed: {str(e)}")

def test_invalid_store_creation(driver):
    try:
        driver.get("https://pillfinder.onrender.com/create-store")
        
        # Try submitting empty form
        WebDriverWait(driver, 30).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Create Store')]"))
        ).click()

        # Verify error message
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.XPATH, "//p[contains(text(), 'All fields are required')]"))
        )

    except Exception as e:
        driver.save_screenshot("invalid_store_error.png")
        pytest.fail(f"Test failed: {str(e)}")
