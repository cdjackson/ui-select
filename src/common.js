
/**
 * Add querySelectorAll() to jqLite.
 *
 * jqLite find() is limited to lookups by tag name.
 * TODO This will change with future versions of AngularJS, to be removed when this happens
 *
 * See jqLite.find - why not use querySelectorAll? https://github.com/angular/angular.js/issues/3586
 * See feat(jqLite): use querySelectorAll instead of getElementsByTagName in jqLite.find https://github.com/angular/angular.js/pull/3598
 */
if (angular.element.prototype.querySelectorAll === undefined) {
    angular.element.prototype.querySelectorAll = function (selector) {
        return angular.element(this[0].querySelectorAll(selector));
    };
}

/**
 * Add closest() to jqLite.
 */
if (angular.element.prototype.closest === undefined) {
    angular.element.prototype.closest = function (selector) {
        var elem = this[0];
        var matchesSelector = elem.matches || elem.webkitMatchesSelector || elem.mozMatchesSelector ||
            elem.msMatchesSelector;

        while (elem) {
            if (matchesSelector.bind(elem)(selector)) {
                return elem;
            } else {
                elem = elem.parentElement;
            }
        }
        return false;
    };
}

var latestId = 0;

var uis = angular.module('ui.select', [])

    .constant('uiSelectConfig', {
        theme: 'bootstrap',
        searchEnabled: true,
        sortable: false,
        placeholder: '', // Empty by default, like HTML tag <select>
        closeOnSelect: true,
        generateId: function () {
            return latestId++;
        },
        appendToBody: false
    })

    // See Rename minErr and make it accessible from outside https://github.com/angular/angular.js/issues/6913
    .service('uiSelectMinErr', function () {
        var minErr = angular.$$minErr('ui.select');
        return function () {
            var error = minErr.apply(this, arguments);
            var message = error.message.replace(new RegExp('\nhttp://errors.angularjs.org/.*'), '');
            return new Error(message);
        };
    })

    // Recreates old behavior of ng-transclude. Used internally.
    .directive('uisTranscludeAppend', function () {
        return {
            link: function (scope, element, attrs, ctrl, transclude) {
                transclude(scope, function (clone) {
                    element.append(clone);
                });
            }
        };
    })

    /**
     * Highlights text that matches $select.search.
     *
     * Taken from AngularUI Bootstrap Typeahead
     * See https://github.com/angular-ui/bootstrap/blob/0.10.0/src/typeahead/typeahead.js#L340
     */
    .filter('highlight', function () {
        function escapeRegexp(queryToEscape) {
            return queryToEscape.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
        }

        return function (matchItem, query) {
            matchItem = String(matchItem);
            return query && matchItem ? matchItem.replace(new RegExp(escapeRegexp(query), 'gi'),
                '<span class="ui-select-highlight">$&</span>') : matchItem;
        };
    })

    /**
     * A read-only equivalent of jQuery's offset function: http://api.jquery.com/offset/
     *
     * Taken from AngularUI Bootstrap Position:
     * See https://github.com/angular-ui/bootstrap/blob/master/src/position/position.js#L70
     */
    .factory('uisOffset',
    ['$document', '$window',
        function ($document, $window) {

            return function (element) {
                var boundingClientRect = element[0].getBoundingClientRect();
                return {
                    width: boundingClientRect.width || element.prop('offsetWidth'),
                    height: boundingClientRect.height || element.prop('offsetHeight'),
                    top: boundingClientRect.top + ($window.pageYOffset || $document[0].documentElement.scrollTop),
                    left: boundingClientRect.left + ($window.pageXOffset || $document[0].documentElement.scrollLeft)
                };
            };
        }]);
