#Important Pre-Test Checklist

Clear Active Trips:
The tracking system allows only one active trip per user. Since the "Painamnae" system currently lacks a "Complete Trip" feature, the tracker may get stuck on an old trip.

Action: Ensure you have no active trips before testing.

How to fix: Run npx prisma studio, go to the routes table, and manually change the status to "COMPLETED".

Clear Notifications:
This test verifies the notification bar. To prevent errors, please delete all existing notifications before starting each test.

*** Settings ***
Library    SeleniumLibrary
Library    DateTime

*** Variables ***

${DELAY}                0.1s


${URL_BASE}             http://localhost:3001
# ${URL_BASE}           http://painamnae05.cpkku.com

${URL_LOGIN}            ${URL_BASE}/login
${URL_CREATE_TRIP}      ${URL_BASE}/createTrip
${URL_MY_ROUTE}         ${URL_BASE}/myRoute
${URL_NOTI}             ${URL_BASE}/notifications

# User
${DRIVER_USER}          driver
${DRIVER_PASS}          Admin1234!
${PASSENGER_USER}       passenger
${PASSENGER_PASS}       Admin1234!

# Login page
${INPUT_USERNAME}       id=identifier
${INPUT_PASSWORD}       id=password
${BTN_LOGIN}            xpath=//button[contains(text(),'Login') or contains(text(),'เข้าสู่ระบบ')]

# Create Trip page
${INPUT_ORIGIN}         id=startPoint
${INPUT_DEST}           id=endPoint
${INPUT_DATE}           id=travelDate
${INPUT_TIME}           id=travelTime
${INPUT_SEATS}          id=seatCount
${INPUT_PRICE}          id=pricePerSeat
${SELECT_CAR}           id=vehicle
${BTN_SUBMIT_TRIP}      xpath=//button[contains(text(),'สร้างการเดินทาง') or @type='submit']

# Search & Book page
${INPUT_SEARCH_ORIGIN}  xpath=//input[@placeholder='จุดเริ่มต้น' or contains(@class,'search-input')]
${BTN_SEARCH}           xpath=//*[contains(text(),'ค้นหา')]
${CARD_PRICE_TEXT}      xpath=(//div[contains(@class,'text-blue-600') and contains(text(),'บาท')])[1]
${BTN_BOOK}             xpath=//*[contains(text(),'จองที่นั่ง')]

# Modal Booking page
${MODAL_BOOKING_TITLE}  xpath=//h3[contains(text(),'ยืนยันการจอง')]
${INPUT_BOOKING_PICKUP}    xpath=//label[contains(text(),'ขึ้นรถ')]/following::input[1]
${INPUT_BOOKING_DROPOFF}   xpath=//label[contains(text(),'ลงรถ')]/following::input[1]
${BTN_CONFIRM_BOOKING}     xpath=//button[contains(text(),'ยืนยันการจอง')]

# Driver Confirm page
${TAB_PENDING}          xpath=//*[contains(text(),'รอดำเนินการ')]
${BTN_CONFIRM_REQ_CARD}    xpath=//button[contains(text(),'ยืนยันคำขอ')]
${MODAL_CONFIRM_TITLE}     xpath=//h3[contains(text(),'ยืนยันคำขอจอง')]
${BTN_CONFIRM_REQ_POPUP}   xpath=//h3[contains(text(),'ยืนยันคำขอจอง')]/following::button[contains(text(),'ยืนยันคำขอ')]

# Notification / Toast
${TOAST_SUCCESS}        xpath=//*[contains(text(),'สำเร็จ')]
${NOTIFICATION_MSG}     xpath=//h3[contains(text(),'คนขับใกล้ถึงแล้ว')]

*** Keywords ***
Open Chrome Fast
    [Arguments]    ${alias_name}
    ${options}=    Evaluate    sys.modules['selenium.webdriver'].ChromeOptions()    sys, selenium.webdriver
    Call Method    ${options}    add_argument    --disable-notifications
    ${prefs}=    Create Dictionary    profile.default_content_setting_values.geolocation=${1}
    Call Method    ${options}    add_experimental_option    prefs    ${prefs}
    Open Browser    ${URL_LOGIN}    chrome    alias=${alias_name}    options=${options}
    Maximize Browser Window
    Set Selenium Speed    ${DELAY}

Fast Login
    [Arguments]    ${user}    ${pass}
    Wait Until Element Is Visible    ${INPUT_USERNAME}    60s
    Input Text      ${INPUT_USERNAME}    ${user}
    Input Text      ${INPUT_PASSWORD}    ${pass}
    Click Element   ${BTN_LOGIN}
    Wait Until Element Is Not Visible    ${BTN_LOGIN}    15s

Input Google Maps Fast
    [Arguments]    ${locator}    ${text}
    Wait Until Element Is Visible    ${locator}    10s
    Click Element    ${locator}
    Input Text    ${locator}    ${text}
    Sleep    1s    
    Press Keys    None    ARROW_DOWN
    Press Keys    None    ENTER

Set Time via JS
    [Arguments]    ${locator_id}    ${time_value}
    Execute Javascript    document.getElementById('${locator_id}').value = '${time_value}';
    Execute Javascript    document.getElementById('${locator_id}').dispatchEvent(new Event('input', { bubbles: true }));
    Execute Javascript    document.getElementById('${locator_id}').dispatchEvent(new Event('change', { bubbles: true }));

JS Click
    [Arguments]    ${xpath}
    Wait Until Page Contains Element    ${xpath}    10s
    ${element}=    Get WebElement    ${xpath}
    Execute Javascript    arguments[0].click();    ARGUMENTS    ${element}
    
*** Test Cases ***
TC02: Driver near not aleart test (distance far more than 5 km)
    
    Open Chrome Fast    DriverBrowser
    
    # Driver สร้าง trip
    Log To Console  Start
    Fast Login    ${DRIVER_USER}    ${DRIVER_PASS}
    Go To    ${URL_CREATE_TRIP}
    
    Input Google Maps Fast    ${INPUT_ORIGIN}      ขอนแก่น
    Input Google Maps Fast    ${INPUT_DEST}        อุดรธานี
    
    ${curr_date}=    Get Current Date
    ${future_time}=  Add Time To Date    ${curr_date}    1 minutes
    ${trip_date_str}=    Convert Date    ${future_time}    result_format=%d%m%Y
    ${trip_time_js}=     Convert Date    ${future_time}    result_format=%H:%M
    
    Input Text       ${INPUT_DATE}        ${trip_date_str}
    Set Time via JS  travelTime           ${trip_time_js}
    Input Text       ${INPUT_SEATS}       1
    Input Text       ${INPUT_PRICE}       100
    Run Keyword And Ignore Error    Select From List By Index    ${SELECT_CAR}    1
    
    Wait Until Element Is Visible    ${BTN_SUBMIT_TRIP}    10s
    Click Element   ${BTN_SUBMIT_TRIP}
    Log To Console  Create Trip Success
    
    Go To    ${URL_LOGIN}

    # Passenger เข้าไปจอง
    Log To Console  Passenger Book
    Fast Login    ${PASSENGER_USER}    ${PASSENGER_PASS}
    
    Wait Until Element Is Visible    ${INPUT_SEARCH_ORIGIN}    10s
    Input Google Maps Fast   ${INPUT_SEARCH_ORIGIN}    ขอนแก่น
    Click Element   ${BTN_SEARCH}
    
    Wait Until Element Is Visible    ${CARD_PRICE_TEXT}    15s
    JS Click    ${CARD_PRICE_TEXT}
    
    Wait Until Page Contains Element    ${BTN_BOOK}    10s
    JS Click    ${BTN_BOOK}
    
    # Passenger ยืนยันการจอง
    Wait Until Element Is Visible    ${MODAL_BOOKING_TITLE}    10s
    Input Google Maps Fast    ${INPUT_BOOKING_PICKUP}    ปัตตานี
    Input Google Maps Fast    ${INPUT_BOOKING_DROPOFF}   ตรัง
    JS Click    ${BTN_CONFIRM_BOOKING}
    
    Wait Until Page Contains Element    ${TOAST_SUCCESS}    15s
    Log To Console  Passenger Book Success

    Go To    ${URL_LOGIN}

    # Driver รับคำขอจองจาก Passenger
    Log To Console  Driver Accept Book
    Fast Login    ${DRIVER_USER}    ${DRIVER_PASS}
    Go To    ${URL_MY_ROUTE}
    
    Run Keyword And Ignore Error    Click Element    ${TAB_PENDING}
    
    Wait Until Element Is Visible    ${BTN_CONFIRM_REQ_CARD}    10s
    Click Element   ${BTN_CONFIRM_REQ_CARD}
    
    Wait Until Element Is Visible    ${MODAL_CONFIRM_TITLE}    10s
    Wait Until Element Is Visible    ${BTN_CONFIRM_REQ_POPUP}    10s
    Click Element    ${BTN_CONFIRM_REQ_POPUP}
    
    Wait Until Page Contains Element    ${TOAST_SUCCESS}    15s
    Log To Console  Driver Accept Book Success

    Reload Page
    Wait Until Element Is Visible    ${TAB_PENDING}    15s


    # Passenger เข้าไปเช็คการแจ้งเตือน
    Log To Console    Passenger check notification
    Open Chrome Fast    PassengerBrowser
    
    Fast Login    ${PASSENGER_USER}    ${PASSENGER_PASS}
    Go To    ${URL_NOTI}
    
    Log To Console    Waiting for Notification (Loop check 6 times)
    
    FOR    ${i}    IN RANGE    6

        ${found}=    Run Keyword And Return Status    Wait Until Page Contains Element    ${NOTIFICATION_MSG}    10s
        
        Run Keyword If    ${found}    Fail    Test Failed: Notification appear (Clear Notification History and Try Again)
        
        Log To Console    No notification found (Correct). Re-checking... (${i+1}/6)
        Reload Page
    END
    
    Log To Console    Passenger not found notification
    
    [Teardown]    Close All Browsers

