*** Settings ***
Library    SeleniumLibrary
Library    RequestsLibrary
Library    Collections
Library    DateTime

*** Variables ***
# --- CONFIGURATION ---
${BASE_URL_API}         http://localhost:3000
${BASE_URL_UI}          http://localhost:3001
${DRIVER_USER}          driver
${DRIVER_PASS}          Admin1234!
${PASSENGER_USER}       passenger
${PASSENGER_PASS}       Admin1234!

# --- LOCATORS ---
${INPUT_USERNAME}       id=identifier
${INPUT_PASSWORD}       id=password
${BTN_LOGIN}            xpath=//button[contains(text(),'Login') or contains(text(),'เข้าสู่ระบบ')]
${TAB_PENDING}          xpath=//*[contains(text(),'รอดำเนินการ')]
${BTN_CONFIRM_REQ_CARD}    xpath=//button[contains(text(),'ยืนยันคำขอ')]
${BTN_CONFIRM_REQ_POPUP}   xpath=//h3[contains(text(),'ยืนยันคำขอจอง')]/following::button[contains(text(),'ยืนยันคำขอ')]
${NOTIFICATION_MSG}     xpath=//*[contains(normalize-space(), 'คนขับใกล้ถึงแล้ว')]

*** Keywords ***
Login API
    [Arguments]    ${user}    ${pass}
    ${body}=    Create Dictionary    username=${user}    password=${pass}
    Create Session    api_session    ${BASE_URL_API}    disable_warnings=1
    ${resp}=    POST On Session    api_session    /api/auth/login    json=${body}
    RETURN    ${resp.json()}[data][token]

Get Near-Future Time UTC
    ${utc_now}=       Get Current Date    UTC
    ${future_time}=   Add Time To Date    ${utc_now}    1 minute
    ${iso_time}=      Convert Date        ${future_time}    result_format=%Y-%m-%dT%H:%M:%S.000Z
    RETURN    ${iso_time}

Open Browser Headless
    [Arguments]    ${alias}
    ${options}=    Evaluate    sys.modules['selenium.webdriver'].ChromeOptions()    sys, selenium.webdriver
    Call Method    ${options}    add_argument    --headless
    Call Method    ${options}    add_argument    --disable-gpu
    Call Method    ${options}    add_argument    --no-sandbox
    Call Method    ${options}    add_argument    --window-size\=1920,1080
    
    ${prefs}=    Create Dictionary    profile.default_content_setting_values.geolocation=${1}
    Call Method    ${options}    add_experimental_option    prefs    ${prefs}
    
    Open Browser    ${BASE_URL_UI}/login    chrome    alias=${alias}    options=${options}

Fast UI Login
    [Arguments]    ${user}    ${pass}
    Wait Until Element Is Visible    ${INPUT_USERNAME}    30s
    Input Text      ${INPUT_USERNAME}    ${user}
    Input Text      ${INPUT_PASSWORD}    ${pass}
    Click Element   ${BTN_LOGIN}
    Wait Until Element Is Not Visible    ${BTN_LOGIN}    15s

*** Test Cases ***
TC01: Real-time Near Alert Verification (Full Hybrid Flow)
    
    # เตรียม Token และ Vehicle ID 
    ${d_token}=       Login API    ${DRIVER_USER}    ${DRIVER_PASS}
    ${p_token}=       Login API    ${PASSENGER_USER}    ${PASSENGER_PASS}
    ${headers_d}=     Create Dictionary    Authorization=Bearer ${d_token}
    ${headers_p}=     Create Dictionary    Authorization=Bearer ${p_token}
    
    ${resp_v}=        GET On Session    api_session    /api/vehicles    headers=${headers_d}
    ${vehicle_id}=    Set Variable    ${resp_v.json()}[data][0][id]

    # Driver Create Trip (API) 
    Log To Console    Creating Trip
    ${trip_time}=     Get Near-Future Time UTC
    ${start_loc}=     Create Dictionary    name=KKU    lat=${16.4746}    lng=${102.8230}
    ${end_loc}=       Create Dictionary    name=Udon   lat=${17.412}     lng=${102.787}
    
    ${payload}=       Create Dictionary    
    ...               startLocation=${start_loc}    endLocation=${end_loc}
    ...               departureTime=${trip_time}    availableSeats=${1}
    ...               pricePerSeat=${100}           vehicleId=${vehicle_id}
    
    ${resp_route}=    POST On Session    api_session    /api/routes    json=${payload}    headers=${headers_d}
    ${route_id}=      Set Variable    ${resp_route.json()}[data][id]
    Log To Console    [OK] Route Created: ${route_id}

    # Passenger Booking (API) 
    Log To Console    Booking Trip
    ${book_payload}=  Create Dictionary    routeId=${route_id}    numberOfSeats=${1}
    ...               pickupLocation=${start_loc}    dropoffLocation=${end_loc}
    ${resp_book}=     POST On Session    api_session    /api/bookings    json=${book_payload}    headers=${headers_p}
    ${booking_id}=    Set Variable    ${resp_book.json()}[data][id]

    # เปิด Browser และ Login 
    Log To Console    Open Browser
    Open Browser Headless    DriverBrowser
    Fast UI Login    ${DRIVER_USER}    ${DRIVER_PASS}

    Open Browser Headless    PassengerBrowser
    Fast UI Login    ${PASSENGER_USER}    ${PASSENGER_PASS}
    Go To    ${BASE_URL_UI}/notifications

    # Confirm Booking (UI) 
    Log To Console    Confirm Booking
    Switch Browser    DriverBrowser
    Go To    ${BASE_URL_UI}/myRoute
    Wait Until Element Is Visible    ${TAB_PENDING}    20s
    Click Element    ${TAB_PENDING}
    Wait Until Element Is Visible    ${BTN_CONFIRM_REQ_CARD}    15s
    Click Element    ${BTN_CONFIRM_REQ_CARD}
    Wait Until Element Is Visible    ${BTN_CONFIRM_REQ_POPUP}    10s
    Click Element    ${BTN_CONFIRM_REQ_POPUP}
    Log To Console    Booking 

    # Inject Route ID เข้า LocalStorage เพื่อบังคับให้ Tracker เริ่มทำงาน 
    Log To Console    Injecting Route ID 
    Execute Javascript    localStorage.setItem('driverTripTracker', '${route_id}');
    Reload Page
    Sleep    5s
    Log To Console    [System] Tracker should be active now.

    # Passenger Monitor Notification 
    Log To Console    Passenger Monitor for คนขับใกล้ถึงแล้ว
    Switch Browser    PassengerBrowser
    
    ${found}=    Set Variable    ${FALSE}
    
    FOR    ${i}    IN RANGE    20
        ${found}=    Run Keyword And Return Status    Wait Until Page Contains Element    ${NOTIFICATION_MSG}    2s
        
        Exit For Loop If    ${found}
        
        Sleep    3s
        Reload Page
        Log To Console    Check Round ${i+1}: Waiting for alert...
    END
    
    Should Be True    ${found}    msg=Notification 'คนขับใกล้ถึงแล้ว' did not appear.

    [Teardown]    Close All Browsers