/**
 * Functionality for the Notifications popup
 * 
 * 1) On page load, fetch the latest x number of notifications. If there are any new ones, these should show a 
 *    number e.g. (3) in the red circle to indicate there are new notifications.
 * 2) When they click the notifications icon, show the popup and whatever recent notifications that are in there.
 * 3) On action packet receive, put the notification at the top of the queue
 */
var notify = {

    // The current notifications
    notifications: [],
    
    // Number of notifications to fetch
    numOfNotifications: 100,
    
    // jQuery objects for faster lookup
    $popup: null,
    $popupIcon: null,
    $popupNum: null,
    
    /**
     * Initialise the notifications system
     */
    init: function() {
        
        // Cache lookups
        this.$popup = $('.top-head .notification-popup');
        this.$popupIcon = $('.top-head .cloud-popup-icon');
        this.$popupNum = $('.top-head .notification-num');
        
        // Init event handlers
        notify.initNotifyIconClickHandler();
    },
    
    /**
     * Get the most recent 100 notifications from the API
     */
    getInitialNotifications: function() {
        
        // Clear notifications before fetching (sometimes this needs to be done if re-logging in)
        notify.notifications = [];
        
        // Call API to fetch the most recent notifications
        api_req('c=' + notify.numOfNotifications, {
            callback: function(result) {

                // Check it wasn't a negative number error response
                if (typeof result !== 'object') {
                    return false;
                }

                // Get the current UNIX timestamp and the last time delta (the last time the user saw a notification)
                var currentTime = Math.round(new Date().getTime() / 1000);
                var lastTimeDelta = (result.ltd) ? result.ltd : 0;       
                var notifications = result.c;

                // Loop through the notifications
                for (var i = 0; i < notifications.length; i++) {

                    var notification = notifications[i];            // The full notification object
                    var id = makeid(10);                            // Make random ID
                    var type = notification.t;                      // Type of notification e.g. share
                    var timeDelta = notification.td;                // Seconds since the notification occurred                    
                    var seen = (timeDelta >= lastTimeDelta);        // If the notification time delta is older than the last time the user saw the notification then it is read
                    var timestamp = currentTime - timeDelta;        // Timestamp of the notification

                    // Add notifications to list
                    notify.notifications.push({
                        id: id,
                        notification: notification,
                        seen: seen,
                        timeDelta: timeDelta,
                        timestamp: timestamp,
                        type: type
                    });
                }

                // Show the notifications
                notify.countAndShowNewNotifications();
            }
        }, 3);  // Use channel 3
    },
    
    /**
     * Counts the new notifications and shows the number of new notifications in a red circle
     */
    countAndShowNewNotifications: function() {
        
        var newNotifications = 0;
        
        // Loop through the notifications
        for (var i = 0; i < notify.notifications.length; i++) {
            
            // If it hasn't been seen yet increment the count
            if (notify.notifications[i].seen === false) {
                newNotifications++;
            }
        }
        
        // If there is a new notification, show the red circle with the number of notifications in it
        if (newNotifications >= 1) {
            notify.$popupNum.removeClass('hidden');
            notify.$popupNum.html(newNotifications);
        }
        else {
            // Otherwise hide it
            notify.$popupNum.addClass('hidden');
            notify.$popupNum.html(newNotifications);
        }
    },
    
    /**
     * Marks all notifications so far as seen, this will hide the red circle 
     * and also make sure on reload these notifications are not new anymore
     */
    markAllNotificationsAsSeen: function() {
        
        // Loop through the notifications and mark them as seen (read)
        for (var i = 0; i < notify.notifications.length; i++) {
            notify.notifications[i].seen = true;
        }
        
        // Hide red circle with number of new notifications
        notify.$popupNum.addClass('hidden');
        notify.$popupNum.html(0);
        
        // Send 'set last acknowledged' API request to inform it which notifications have been seen 
        // up to this point then they won't show these notifications as new next time they are fetched
        api_req({ a: 'sla', i: requesti });
    },
    
    
    /**
     * Open the notifications popup when clicking the notifications icon
     */
    initNotifyIconClickHandler: function() {
        
        // Add delegated event for when the notifications icon is clicked
        $('.top-head').on('click', '.cloud-popup-icon', function() {
            
            // If the popup is already open, then close it
            if (notify.$popup.hasClass('active')) {
                notify.closePopup();
            }
            else {
                // Otherwise open the popup
                notify.openPopup();
            }
        });
    },
    
    /**
     * Opens the notification popup with notifications
     */
    openPopup: function() {
        
        // Calculate the position of the notifications popup so it is centered beneath the notifications icon.
        // This is dynamically calculated because sometimes the icon position can change depending on the top nav.
        var popupPosition = notify.$popupIcon.offset().left - 40;

        // Set the position of the notifications popup and open it
        notify.$popup.css('left', popupPosition + 'px');
        notify.$popup.addClass('active');
        notify.$popupIcon.addClass('active');

        // Render and show notifications currently in list
        notify.renderNotifications();
    },
    
    /**
     * Closes the popup
     */
    closePopup: function() {
        
        // Make sure it is actually shown (otherwise any call to $.hideTopMenu could trigger this
        if ((notify.$popup !== null) && (notify.$popup.hasClass('active'))) {

            // Hide the popup
            notify.$popup.removeClass('active');
            notify.$popupIcon.removeClass('active');

            // Mark all notifications as seen seeing the popup has been opened and they have been viewed
            notify.markAllNotificationsAsSeen();
        }
    },
    
    /**
     * Sort the notifications so the most recent ones appear first in the popup
     */
    sortNotificationsByMostRecent: function() {

        notify.notifications.sort(function(notificationA, notificationB) {

            if (notificationA.timestamp > notificationB.timestamp) {
                return -1;
            }
            else if (notificationA.timestamp < notificationB.timestamp) {
                return 1;
            }
            else {
                return 0;
            }
        });
    },
    
    /**
     * To do: render the notifications in the popup
     */
    renderNotifications: function() {
        
        // Get the number of notifications
        var numOfNotifications = notify.notifications.length;
        
        // If no notifications, show empty
        if (numOfNotifications === 0) {
            notify.$popup.addClass('empty');
            return false;
        }
        
        // Sort the notifications
        notify.sortNotificationsByMostRecent();

        // Store for the all the generated HTML
        var notificationHtml = '';
        var $template = this.$popup.find('.notification-item.template');

        // Loop through all the notifications
        for (var i = 0; i < numOfNotifications; i++) {
            
            // Get the notification data and clone the template
            var notification = notify.notifications[i];
            var $notificationHtml = $template.clone();
            
            // Remove the template class
            $notificationHtml.removeClass('template');
            
            // Update template
            $notificationHtml.find('.notification-date').text(Date.now());
            
            // Build the html
            notificationHtml += notify.getOuterHtml($notificationHtml);
        }
        
        // Update the list of notifications
        notify.$popup.find('.notification-scr-list').append(notificationHtml);
        notify.$popup.removeClass('empty');;
    },
    
    /**
     * Gets the outer HTML of an element
     * @param {Object} $element The jQuery element $('<div class="notification-item">...</div>')
     * @returns {String} Returns just the outer HTML '<div class="notification-item">...</div>'
     */
    getOuterHtml: function($element)
    {
        return $element.clone().wrap('<div>').parent().html();
    }
};

// Tests

/*

{"c":[{"u":"DKLLwlj_THc","c":0,"m":"am@mega.co.nz","t":"c","td":21025164},{"t":"share","n":"tVYhHaqC","u":"DKLLwlj_THc","td":21024593},{"t":"share","n":"tVYhHaqC","u":"DKLLwlj_THc","td":21024496},{"t":"share","n":"tVYhHaqC","u":"DKLLwlj_THc","td":21024406},{"t":"share","n":"FI40RK7R","u":"DKLLwlj_THc","td":20837105},{"t":"share","n":"FI40RK7R","u":"DKLLwlj_THc","td":20837095},{"t":"dshare","n":"FI40RK7R","u":"DKLLwlj_THc","td":20837088},{"t":"share","n":"FI40RK7R","u":"DKLLwlj_THc","td":20837079},{"t":"share","n":"FI40RK7R","u":"DKLLwlj_THc","td":20837075},{"t":"dshare","n":"FI40RK7R","u":"DKLLwlj_THc","td":20837070},{"t":"share","n":"wN51GbbA","u":"DKLLwlj_THc","td":20837052},{"t":"share","n":"wN51GbbA","u":"DKLLwlj_THc","td":20837049},{"t":"dshare","n":"wN51GbbA","u":"DKLLwlj_THc","td":20837043},{"t":"dshare","n":"tVYhHaqC","u":"DKLLwlj_THc","td":20837036},{"t":"share","n":"FI40RK7R","u":"DKLLwlj_THc","td":20837026},{"t":"share","n":"FI40RK7R","u":"DKLLwlj_THc","td":20837023},{"t":"dshare","n":"FI40RK7R","u":"DKLLwlj_THc","td":20837017},{"u":"iGfLqRzTtQo","c":1,"m":"csr+livetest@mega.co.nz","t":"c","td":20487974},{"t":"share","n":"iFA3wI6A","u":"iGfLqRzTtQo","td":20487974},{"t":"share","n":"iFA3wI6A","u":"iGfLqRzTtQo","td":20487969},{"t":"dshare","n":"iFA3wI6A","u":"iGfLqRzTtQo","td":20487161},{"t":"share","n":"iFA3wI6A","u":"iGfLqRzTtQo","td":20487152},{"t":"share","n":"iFA3wI6A","u":"iGfLqRzTtQo","td":20487148},{"t":"share","n":"iFA3wI6A","u":"iGfLqRzTtQo","td":20487146},{"t":"share","n":"PRBj1agA","u":"iGfLqRzTtQo","td":20397003},{"t":"share","n":"rJJHBBqR","u":"iGfLqRzTtQo","td":20391218},{"t":"share","n":"fZpFgBCI","u":"iGfLqRzTtQo","td":20318515},{"t":"share","n":"fZpFgBCI","u":"iGfLqRzTtQo","td":20317644},{"t":"dshare","n":"fZpFgBCI","u":"iGfLqRzTtQo","td":20317610},{"t":"share","n":"fZpFgBCI","u":"iGfLqRzTtQo","td":20313000},{"t":"share","n":"DdwG3JiK","u":"iGfLqRzTtQo","td":20312944},{"t":"share","n":"GUJDXCBD","u":"iGfLqRzTtQo","td":20311446},{"t":"share","n":"HcBlXQyb","u":"iGfLqRzTtQo","td":20311288},{"t":"share","n":"HcBlXQyb","u":"iGfLqRzTtQo","td":20311247},{"t":"share","n":"rYwxTIDI","u":"iGfLqRzTtQo","td":20311106},{"t":"share","n":"iRZDXKoY","u":"iGfLqRzTtQo","td":20310448},{"t":"put","n":"y98HzCyR","u":"Hg9SZlSGQY4","f":[{"h":"f9lRiZyB","t":0},{"h":"nkshCTaA","t":0},{"h":"mhlFDDxI","t":1},{"h":"K4UUhBBR","t":0},{"h":"a4U1TZ7Y","t":0},{"h":"z082hIIL","t":0},{"h":"fxUChYqL","t":0},{"h":"3sFyHL7K","t":0},{"h":"OgtHkSBI","t":0},{"h":"utk3la5L","t":0},{"h":"uhMmCKyK","t":0},{"h":"bolh0TaQ","t":0},{"h":"P5s00CDT","t":0},{"h":"qplVla7R","t":0},{"h":"LktDmASJ","t":0},{"h":"fp002RTQ","t":0},{"h":"X8M2UYwD","t":0},{"h":"LoExmA7L","t":0},{"h":"e4F2nZgQ","t":0},{"h":"3k0Q3aoY","t":0},{"h":"exlyxTiC","t":0},{"h":"uxVUiQLZ","t":0},{"h":"35dEgBLD","t":0},{"h":"7hliwDyR","t":0},{"h":"75kQADqS","t":0},{"h":"bpkjzCxB","t":0},{"h":"ShsS0a7J","t":0},{"h":"z9NBhbgL","t":0},{"h":"O18QXAgD","t":0},{"h":"f1NX0CiI","t":0},{"h":"n1sXEKwB","t":0},{"h":"W9lWHIjC","t":0},{"h":"mscwHQgJ","t":0},{"h":"TsclgICK","t":0},{"h":"ystllQxK","t":0},{"h":"G09EDbTD","t":0},{"h":"Gld2DIiB","t":0},{"h":"6htE1JpS","t":0},{"h":"WtEgkJKS","t":0},{"h":"CxEEmYhL","t":0},{"h":"Dgsi3K5J","t":0},{"h":"mhURzSbQ","t":0},{"h":"PxcSwSoA","t":0},{"h":"SgcxlYYR","t":0},{"h":"2w8wUKJT","t":0},{"h":"PwNAxBBb","t":0},{"h":"2sECEZAQ","t":0},{"h":"q9dUGD5a","t":0},{"h":"25ECHQCK","t":0},{"h":"r88kERpD","t":0},{"h":"j4tEBBKb","t":0},{"h":"qwMXlJ5Z","t":0},{"h":"vxF01RaR","t":0},{"h":"KodHGBRD","t":0},{"h":"GoMQzYhB","t":0},{"h":"i9FQUACT","t":0},{"h":"K9VjzY6Z","t":0},{"h":"H1N02ASS","t":0},{"h":"jo0RHa5a","t":0},{"h":"Tg0XUQQC","t":0},{"h":"TlMGzLwB","t":0},{"h":"epUGXRqZ","t":0},{"h":"T4dzwLbb","t":0},{"h":"TslkAaZb","t":0},{"h":"fwci1BAJ","t":0},{"h":"T4t3lTxK","t":0},{"h":"ngsU2LAI","t":0},{"h":"6styECKY","t":0},{"h":"n91RiTyC","t":0},{"h":"Hk0AkBSA","t":0},{"h":"HstQ0a7b","t":0},{"h":"y91ThayI","t":0},{"h":"esVG1ZpJ","t":0},{"h":"Lt9U1T6Q","t":0},{"h":"m8tzWDYC","t":0},{"h":"OxdCBRjK","t":0},{"h":"3s9REIyL","t":0},{"h":"70UxRTqb","t":0},{"h":"X9FiQYab","t":0},{"h":"O1EzVKhY","t":0},{"h":"C99y0Lwa","t":0},{"h":"7xUEAZ4J","t":0},{"h":"v59SkDSB","t":0},{"h":"25EEQRLL","t":0},{"h":"WskWBDYY","t":0},{"h":"mw1iTZRD","t":0},{"h":"TosADArD","t":0},{"h":"X0dlXagT","t":0},{"h":"PpslEZwD","t":0},{"h":"6h1i1BjC","t":0},{"h":"O0dQxCRI","t":0},{"h":"r8MC3LqR","t":0},{"h":"2kNWWbqI","t":0},{"h":"ipNlRBLb","t":0},{"h":"e5cmUKyY","t":0},{"h":"a8UD2bwY","t":0},{"h":"CpVkVQrY","t":0},{"h":"yo8UyIiQ","t":0},{"h":"3xtinYgK","t":0},{"h":"zgsWACYR","t":0},{"h":"TtcVkQBA","t":0},{"h":"Xt8inI5T","t":0},{"h":"mwcnGT7b","t":0},{"h":"SgUVyLzb","t":0},{"h":"mt0TQbIY","t":0},{"h":"Kh0yVCJB","t":0},{"h":"SkVTDbBC","t":0},{"h":"6h91lTYS","t":0},{"h":"f5UlSbiS","t":0},{"h":"60dxXJzI","t":0},{"h":"nsFAkCIT","t":0},{"h":"P0thmR4K","t":0},{"h":"K5dniRAA","t":0},{"h":"38VAhLyR","t":0},{"h":"P1tHlYgL","t":0},{"h":"DgVUhRbJ","t":0},{"h":"Pt9wwQCC","t":0},{"h":"i8cGTAIL","t":0},{"h":"SoVyTL6D","t":0},{"h":"n0ln1arI","t":0},{"h":"axtz0S6Y","t":0},{"h":"G11CzChT","t":0},{"h":"Hg8WkJrJ","t":0},{"h":"ag0xjIqA","t":0},{"h":"2hkljJJC","t":0},{"h":"Hw0wVRLK","t":0},{"h":"69Mm0LwR","t":0},{"h":"X9skSZ7J","t":0},{"h":"y4kk2RjB","t":0},{"h":"j5MwXZ5a","t":0},{"h":"z91HFRSI","t":0},{"h":"mpcyzIAJ","t":0},{"h":"y1FWUA7Z","t":0},{"h":"LkVj2awT","t":0},{"h":"CgtnmT5R","t":0},{"h":"PodgzQRC","t":0},{"h":"zk8yUTTJ","t":0},{"h":"65U2QARJ","t":0},{"h":"ms9llYRR","t":0},{"h":"q99mzawI","t":0},{"h":"bpVynaqL","t":0},{"h":"rk8VnagR","t":0},{"h":"mxEi0ASL","t":0},{"h":"Hp8E3RDb","t":0},{"h":"G0tWnAqI","t":0},{"h":"ns8Dgaqb","t":0},{"h":"fp0RiIjS","t":0},{"h":"j5lTnTja","t":0},{"h":"L49nEC5A","t":0},{"h":"P4MhXaRA","t":0},{"h":"Lp1yyZzY","t":0},{"h":"ysMhDLQI","t":0},{"h":"XxFxADYR","t":0},{"h":"PpFB1BQI","t":0},{"h":"utsmVYqC","t":0},{"h":"mokFQA6T","t":0},{"h":"LkFEmSaT","t":0},{"h":"vkNWSTCL","t":0},{"h":"Gp1lRZTC","t":0},{"h":"exkWSCCJ","t":0},{"h":"6h8SVB6C","t":0},{"h":"DxtjRS6Z","t":0},{"h":"ToEzlKpS","t":0},{"h":"3h9mxIza","t":0},{"h":"D1kU2aSY","t":0},{"h":"HlUxVYqS","t":0},{"h":"TkVUVJpK","t":0},{"h":"OwknXC4a","t":0},{"h":"uxl3AL5D","t":0},{"h":"6l0lSZAZ","t":0},{"h":"CwVVGCQI","t":0},{"h":"e08niJTY","t":0},{"h":"6lUyUATA","t":0},{"h":"61cBxLiR","t":0},{"h":"30E1gapA","t":0},{"h":"Ok8WQZpR","t":0},{"h":"n1tHCQgC","t":0},{"h":"HhcFjYKI","t":0},{"h":"P8VGXRiY","t":0},{"h":"allhyIyB","t":0},{"h":"q10ziSZD","t":0},{"h":"XpUn3LiJ","t":0},{"h":"bpMHWIba","t":0},{"h":"H5VXiQ6I","t":0},{"h":"H1chzBLB","t":0},{"h":"Pp9SlAiI","t":0},{"h":"uxljjRhK","t":0},{"h":"yk1zgSgR","t":0},{"h":"ik8R1I5I","t":0},{"h":"fxUh3JhB","t":0},{"h":"nxcjnR6I","t":0},{"h":"jhN0hL7T","t":0},{"h":"bxFVyBLC","t":0},{"h":"uwtACJoR","t":0},{"h":"7k9WjbDY","t":0},{"h":"q0EHxLTb","t":0},{"h":"v5ljEJjI","t":0},{"h":"r5NS2azB","t":0},{"h":"e1tRARbY","t":0},{"h":"C5kEXKqI","t":0},{"h":"Wl8WzAST","t":0},{"h":"jkMRkaia","t":0},{"h":"fkUmhIRR","t":0},{"h":"S1ElnAiB","t":0},{"h":"ek8DxKZK","t":0},{"h":"K8tHDZSL","t":0},{"h":"Dh82zDhB","t":0},{"h":"S58BxADb","t":0},{"h":"Toc2CAoT","t":0},{"h":"SxMmhDhZ","t":0},{"h":"75syiZjI","t":0},{"h":"CklwmDyT","t":0},{"h":"awszBCKB","t":0},{"h":"rwV1kQIR","t":0},{"h":"O4UTwT6K","t":0},{"h":"WllSHYCB","t":0},{"h":"mpc0DJwb","t":0},{"h":"epdE2ZYJ","t":0},{"h":"6k8xmRjD","t":0},{"h":"H5VgWR6D","t":0},{"h":"WhM2kAxL","t":0},{"h":"u8UjHZ6Q","t":0},{"h":"P0EUCDYZ","t":0},{"h":"jxl1GYzA","t":0},{"h":"ixMSATqB","t":0},{"h":"74kk3LjR","t":0},{"h":"mltBUBhD","t":0},{"h":"bt8jmBwK","t":0},{"h":"ToURRAwR","t":0},{"h":"v5MClSoa","t":0},{"h":"X49yGAYY","t":0},{"h":"zl8zCSoJ","t":0},{"h":"ukd3UYgY","t":0},{"h":"D18kyRBL","t":0},{"h":"3l00HAzI","t":0},{"h":"CkFxnYRC","t":0},{"h":"a1EVEZbA","t":0},{"h":"atVWAB7L","t":0},{"h":"ThsgRTKB","t":0},{"h":"rgsUDLyS","t":0},{"h":"vx0mwY7R","t":0},{"h":"CgVxRbJI","t":0},{"h":"34ERkJZK","t":0},{"h":"3skDkaob","t":0},{"h":"mk8D0KDQ","t":0},{"h":"Wk1lBI6a","t":0},{"h":"Og8iED5Z","t":0},{"h":"rlNjVBrK","t":0},{"h":"OgtUDJxK","t":0},{"h":"K0tlTa7A","t":0},{"h":"OsVgRTBJ","t":0},{"h":"qtMUmD7K","t":0},{"h":"7oEj3R4A","t":0},{"h":"blUwER5Y","t":0},{"h":"W1sg0LiC","t":0},{"h":"X8E0DYrL","t":0},{"h":"v1cDULrT","t":0},{"h":"KhNm3a4b","t":0},{"h":"bt0ihZrR","t":0},{"h":"3sV1xRjb","t":0},{"h":"z8UTTSbL","t":0},{"h":"34lBSRST","t":0},{"h":"ep8lRLQa","t":0},{"h":"KkVkWSpC","t":0},{"h":"q41yWLRa","t":0},{"h":"KpshmIDY","t":0},{"h":"64ckHLzC","t":0},{"h":"WwkHnSBD","t":0},{"h":"ipkU2TQC","t":0},{"h":"qokE3DSL","t":0},{"h":"ytMylSpT","t":0},{"h":"y09x3KoT","t":0},{"h":"SgUXiQCJ","t":0},{"h":"25VB1SYQ","t":0},{"h":"71MiBbBQ","t":0},{"h":"a9cB2Zga","t":0},{"h":"2ptG3TBI","t":0},{"h":"u49H1CiL","t":0},{"h":"aoFnRDiS","t":0},{"h":"mhElDaCT","t":0},{"h":"W59UFDKJ","t":0},{"h":"6lN1HDRC","t":0},{"h":"OtkR0DZI","t":0},{"h":"2t0FCCyT","t":0},{"h":"nwlB2SxR","t":0},{"h":"iptTQCoS","t":0},{"h":"Xh9j3Iga","t":0},{"h":"W1lk3AKJ","t":0},{"h":"Pg9XhCjD","t":0},{"h":"Ol8mHDSA","t":0},{"h":"qw8AwLpS","t":0},{"h":"y1UB3aIZ","t":0},{"h":"OwFWHRgC","t":0},{"h":"zosy2KzB","t":0},{"h":"79UzkRqL","t":0},{"h":"Cpc3WagY","t":0},{"h":"u18FBD7b","t":0},{"h":"LwcSnLYI","t":0},{"h":"a88DVTCB","t":0},{"h":"3xs0HSiQ","t":0},{"h":"DpsUjShB","t":0},{"h":"LtUS2LaZ","t":0},{"h":"3tNVUZga","t":0},{"h":"TpMUzS5S","t":0},{"h":"apkxxBJK","t":0},{"h":"ns90XCgA","t":0},{"h":"WlcBTSiT","t":0},{"h":"y80SVAgT","t":0},{"h":"29dyhDrD","t":0},{"h":"GwV0nBRQ","t":0},{"h":"mtkFwRTI","t":0},{"h":"Op1hmJoA","t":0},{"h":"a0cGTIzB","t":0},{"h":"2gknCIoY","t":0},{"h":"mp0zFbZT","t":0},{"h":"PhFhkayA","t":0},{"h":"ugsmiITT","t":0},{"h":"SksHSKxS","t":0},{"h":"CxVkXJ5R","t":0},{"h":"y8dgHYzD","t":0}],"td":19621922},{"t":"share","n":"1c5BBTJB","u":"DKLLwlj_THc","td":19626226},{"t":"share","n":"dNIASDKK","u":"DKLLwlj_THc","td":19626194},{"t":"share","n":"JUJHlBQD","u":"DKLLwlj_THc","td":19626171},{"t":"dshare","n":"dNIASDKK","u":"DKLLwlj_THc","td":19626164},{"t":"put","n":"mhlFDDxI","u":"Hg9SZlSGQY4","f":[{"h":"Th8HEDxL","t":0},{"h":"KsUXiZZb","t":0},{"h":"T58H0Iba","t":0},{"h":"PgkEUKLR","t":0},{"h":"nxlGVbpS","t":0},{"h":"6l1hGbBJ","t":0},{"h":"Xx8ABRiJ","t":0},{"h":"esFGXbSC","t":0},{"h":"XllCVZDZ","t":0},{"h":"T01lXABT","t":0},{"h":"Xs1AnTqL","t":0},{"h":"K4MSwZZJ","t":0}],"td":19621948},{"t":"put","n":"1wthkABL","u":"jUdM1j-ziSw","f":[{"h":"dt1T2CTC","t":0},{"h":"0pkgkRBD","t":0}],"td":18216670},{"u":"Nxmg2MOw2CI","c":1,"m":"am+test@mega.co.nz","t":"c","td":15649856},{"t":"share","n":"EAxxABQa","u":"Nxmg2MOw2CI","td":15649856},{"t":"dshare","n":"EAxxABQa","u":"Nxmg2MOw2CI","td":15106196},{"t":"dshare","n":"JUJHlBQD","u":"DKLLwlj_THc","td":15106192},{"t":"dshare","n":"1c5BBTJB","u":"DKLLwlj_THc","td":15106192},{"t":"ipc","p":"ktJ69VVGpdc","m":"am@mega.co.nz","msg":"","ps":0,"ts":1421657733,"uts":1421657733,"i":"eWIvhhhEtt","td":15106067},{"t":"ipc","p":"ktJ69VVGpdc","m":"am@mega.co.nz","dts":1421657756,"ou":"DKLLwlj_THc","i":"eWIvhhhEtt","td":15106043},{"t":"ipc","p":"DhmoEDNO4Ps","m":"am@mega.co.nz","msg":"undefined","ps":0,"ts":1421657762,"uts":1421657762,"i":"eWIvhhhEtt","td":15106038},{"t":"ipc","p":"WdbX5lwiZ0g","m":"am@mega.co.nz","msg":"undefined","ps":0,"ts":1421657935,"uts":1421657935,"i":"eWIvhhhEtt","td":15105865},{"t":"ipc","p":"0uUure4TCJw","m":"am@mega.co.nz","msg":"","ps":0,"ts":1421658198,"uts":1421658198,"i":"eWIvhhhEtt","td":15105602},{"t":"dshare","n":"fZpFgBCI","u":"iGfLqRzTtQo","td":15105565},{"t":"dshare","n":"GUJDXCBD","u":"iGfLqRzTtQo","td":15105565},{"t":"dshare","n":"iRZDXKoY","u":"iGfLqRzTtQo","td":15105565},{"t":"dshare","n":"PRBj1agA","u":"iGfLqRzTtQo","td":15105565},{"t":"dshare","n":"HcBlXQyb","u":"iGfLqRzTtQo","td":15105565},{"t":"dshare","n":"rYwxTIDI","u":"iGfLqRzTtQo","td":15105565},{"t":"dshare","n":"iFA3wI6A","u":"iGfLqRzTtQo","td":15105565},{"t":"dshare","n":"rJJHBBqR","u":"iGfLqRzTtQo","td":15105565},{"t":"dshare","n":"DdwG3JiK","u":"iGfLqRzTtQo","td":15105565},{"u":"DKLLwlj_THc","c":1,"m":"am@mega.co.nz","t":"c","td":15104882},{"t":"share","n":"4FJh3ADJ","u":"DKLLwlj_THc","td":15104882},{"t":"dshare","n":"JUJHlBQD","u":"DKLLwlj_THc","td":15104195},{"t":"dshare","n":"4FJh3ADJ","u":"DKLLwlj_THc","td":15104195},{"t":"ipc","p":"t17TPe65rMM","m":"am@mega.co.nz","msg":"","ps":0,"ts":1421660047,"uts":1421660047,"i":"YobISDXCQY","td":15103753},{"t":"share","n":"FI40RK7R","u":"DKLLwlj_THc","td":15103316},{"t":"share","n":"QARijASQ","u":"DKLLwlj_THc","td":15103191},{"t":"dshare","n":"FI40RK7R","u":"DKLLwlj_THc","td":15103099},{"t":"dshare","n":"QARijASQ","u":"DKLLwlj_THc","td":15103099},{"t":"ipc","p":"Hi21zshLlEc","m":"am@mega.co.nz","msg":"","ps":0,"ts":1421660746,"uts":1421660746,"i":"YobISDXCQY","td":15103054},{"t":"ipc","p":"6nfqaOpEcBw","m":"am@mega.co.nz","msg":"","ps":0,"ts":1421661005,"uts":1421661005,"i":"YobISDXCQY","td":15102795},{"u":"DKLLwlj_THc","c":0,"m":"am@mega.co.nz","m2":["am@mega.co.nz"],"t":"c","td":15102567},{"t":"ipc","p":"ltq-FzCl-r4","m":"am@mega.co.nz","msg":"","ps":0,"ts":1421661275,"uts":1421661275,"i":"YobISDXCQY","td":15102525},{"u":"DKLLwlj_THc","c":0,"m":"am@mega.co.nz","m2":["am@mega.co.nz"],"t":"c","td":15102239},{"t":"ipc","p":"kVJxmI6KjTo","m":"am@mega.co.nz","msg":"","ps":0,"ts":1421661647,"uts":1421661647,"i":"YobISDXCQY","td":15102153},{"t":"dshare","n":"hE4z1SSZ","u":"DKLLwlj_THc","td":15101850},{"t":"dshare","n":"hcoElaqB","u":"DKLLwlj_THc","td":15101850},{"t":"dshare","n":"4FJh3ADJ","u":"DKLLwlj_THc","td":15101850},{"t":"ipc","p":"lYP5mTNvsjY","m":"am@mega.co.nz","msg":"","ps":0,"ts":1421662058,"uts":1421662058,"i":"YobISDXCQY","td":15101742},{"t":"share","n":"hcoElaqB","u":"DKLLwlj_THc","td":15099927},{"u":"VlCObJfh1gk","c":0,"m":"mh@mega.co.nz","t":"c","td":15063334},{"u":"UCQh2d5h5vI","c":1,"m":"mh@mega.co.nz","m2":["mh@mega.co.nz"],"t":"c","td":15061991},{"u":"4mmXu_081H4","c":1,"m":"gk@mega.co.nz","m2":["gk@mega.co.nz"],"t":"c","td":15055412},{"t":"ipc","p":"GtyC1sg6Woc","m":"am+maintenancetest4@mega.co.nz","msg":"Hello, join me on MEGA and get access to encrypted storage and communication. Get 50 GB free!","ps":0,"ts":1421709779,"uts":1421709779,"i":"pTZ7hCAtsN","td":15054021},{"u":"DKLLwlj_THc","c":0,"m":"am@mega.co.nz","m2":["am@mega.co.nz"],"t":"c","td":15053202},{"t":"ipc","p":"um9vdXB-g2g","m":"am@mega.co.nz","msg":"Hello, join me on MEGA and get access to encrypted storage and communication. Get 50 GB free!","ps":0,"ts":1421710627,"uts":1421710627,"i":"FlOjtqTdmI","td":15053173},{"t":"ipc","p":"s0UfFM3c1EE","m":"am+renametest666@mega.co.nz","msg":"Hello, join me on MEGA and get access to encrypted storage and communication. Get 50 GB free!","ps":0,"ts":1421720771,"uts":1421720771,"i":"o7FPbqMGBx","td":15043029},{"t":"dshare","n":"hcoElaqB","u":"DKLLwlj_THc","td":15041548},{"t":"dshare","n":"kNZ1RIYb","u":"DKLLwlj_THc","td":15041548},{"u":"Jzike6IsdMQ","c":1,"m":"am+renametest666@mega.co.nz","m2":["am+renametest666@mega.co.nz"],"t":"c","td":15041514},{"t":"ipc","p":"s_vKEKg0whM","m":"am@mega.co.nz","msg":"Hello, join me on MEGA and get access to encrypted storage and communication. Get 50 GB free!","ps":0,"ts":1421723262,"uts":1421723262,"i":"H2oI24fWgr","td":15040538},{"t":"ipc","p":"r2c3bW4luLw","m":"am@mega.co.nz","msg":"Hello, join me on MEGA and get access to encrypted storage and communication. Get 50 GB free!","ps":0,"ts":1421728464,"uts":1421728464,"i":"n4KQFWppMx","td":15035336},{"t":"ipc","p":"rSZBYzZbEYI","m":"am@mega.co.nz","msg":"Hello, join me on MEGA and get access to encrypted storage and communication. Get 50 GB free!","ps":0,"ts":1421728547,"uts":1421728547,"i":"n4KQFWppMx","td":15035253},{"u":"DKLLwlj_THc","c":1,"m":"am@mega.co.nz","m2":["am@mega.co.nz"],"t":"c","td":15034735},{"u":"DKLLwlj_THc","c":0,"m":"am@mega.co.nz","m2":["am@mega.co.nz"],"t":"c","td":15032152},{"t":"ipc","p":"5w7n5rgfJ74","m":"am@mega.co.nz","msg":"Hello, join me on MEGA and get access to encrypted storage and communication. Get 50 GB free!","ps":0,"ts":1421733412,"uts":1421733412,"i":"rmvqt1RF3j","td":15030388},{"u":"DKLLwlj_THc","c":0,"m":"am@mega.co.nz","m2":["am@mega.co.nz"],"t":"c","td":15026879},{"t":"ipc","p":"qGiVHyFyo64","m":"am@mega.co.nz","msg":"Hello, join me on MEGA and get access to encrypted storage and communication. Get 50 GB free!","ps":0,"ts":1421736928,"uts":1421736928,"i":"rBnIhzCIWD","td":15026872},{"t":"ipc","p":"qGiVHyFyo64","m":"am@mega.co.nz","dts":1421736949,"ou":"DKLLwlj_THc","i":"rBnIhzCIWD","td":15026851}],"lsn":"sul2n8KdFuk","u":[{"u":"DKLLwlj_THc","m":"am@mega.co.nz","m2":["am@mega.co.nz"],"n":"Andre Meister"},{"u":"Nxmg2MOw2CI","m":"am+test@mega.co.nz","m2":["am+test@mega.co.nz"],"n":"am am"},{"u":"iGfLqRzTtQo","m":"csr+livetest@mega.co.nz","m2":["csr+livetest@mega.co.nz"],"n":"Chris R"}],"fsn":"_EQXztFzmQo"}

 */