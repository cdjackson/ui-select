/*!
 * ui-select
 * http://github.com/angular-ui/ui-select
 * Version: 0.12.1 - 2015-08-11T18:41:59.483Z
 * License: MIT
 */


(function () { 
"use strict";

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

uis.directive('uiSelectChoices',
    ['uiSelectConfig', 'uisRepeatParser', 'uiSelectMinErr', '$compile',
        function (uiSelectConfig, RepeatParser, uiSelectMinErr, $compile) {

            return {
                restrict: 'EA',
                require: '^uiSelect',
                replace: true,
                transclude: true,
                templateUrl: function (tElement) {
                    // Gets theme attribute from parent (ui-select)
                    var theme = tElement.parent().attr('theme') || uiSelectConfig.theme;
                    return theme + '/choices.tpl.html';
                },

                compile: function (tElement, tAttrs) {

                    if (!tAttrs.repeat) {
                        throw uiSelectMinErr('repeat', "Expected 'repeat' expression.");
                    }

                    return function link(scope, element, attrs, $select, transcludeFn) {

                        // var repeat = RepeatParser.parse(attrs.repeat);
                        var groupByExp = attrs.groupBy;
                        var groupFilterExp = attrs.groupFilter;

                        $select.parseRepeatAttr(attrs.repeat, groupByExp, groupFilterExp); //Result ready at $select.parserResult

                        $select.disableChoiceExpression = attrs.uiDisableChoice;
                        $select.onHighlightCallback = attrs.onHighlight;

                        if (groupByExp) {
                            var groups = element.querySelectorAll('.ui-select-choices-group');
                            if (groups.length !== 1) throw uiSelectMinErr('rows',
                                "Expected 1 .ui-select-choices-group but got '{0}'.", groups.length);
                            groups.attr('ng-repeat', RepeatParser.getGroupNgRepeatExpression());
                        }

                        var choices = element.querySelectorAll('.ui-select-choices-row');
                        if (choices.length !== 1) {
                            throw uiSelectMinErr('rows', "Expected 1 .ui-select-choices-row but got '{0}'.",
                                choices.length);
                        }

                        choices.attr('ng-repeat',
                            RepeatParser.getNgRepeatExpression($select.parserResult.itemName, '$select.items',
                                $select.parserResult.trackByExp, groupByExp))
                            .attr('ng-if', '$select.open') // Prevent unnecessary watches when dropdown is closed
                            .attr('ng-mouseenter', '$select.setActiveItem(' + $select.parserResult.itemName + ')')
                            .attr('ng-click', '$select.select(' + $select.parserResult.itemName + ',false,$event)');

                        var rowsInner = element.querySelectorAll('.ui-select-choices-row-inner');
                        if (rowsInner.length !== 1) {
                            throw uiSelectMinErr('rows',
                                "Expected 1 .ui-select-choices-row-inner but got '{0}'.", rowsInner.length);
                        }
                        rowsInner.attr('uis-transclude-append', ''); //Adding uisTranscludeAppend directive to row element after choices element has ngRepeat

                        $compile(element, transcludeFn)(scope); //Passing current transcludeFn to be able to append elements correctly from uisTranscludeAppend

                        scope.$watch('$select.search', function (newValue) {
                            if (newValue && !$select.open && $select.multiple) {
                                $select.activate(false, true);
                            }
                            $select.activeIndex = 0;
                        });
                    };
                }
            };
        }]);

/**
 * Contains ui-select "intelligence".
 *
 * The goal is to limit dependency on the DOM whenever possible and
 * put as much logic in the controller (instead of the link functions) as possible so it can be easily tested.
 */
uis.controller('uiSelectCtrl',
    ['$scope', '$element', '$timeout', '$filter', '$q', 'uisRepeatParser', 'uiSelectMinErr', 'uiSelectConfig',
        function ($scope, $element, $timeout, $filter, $q, RepeatParser, uiSelectMinErr, uiSelectConfig) {
            var ctrl = this;

            var EMPTY_SEARCH = '';

            ctrl.placeholder = uiSelectConfig.placeholder;
            ctrl.searchEnabled = uiSelectConfig.searchEnabled;
            ctrl.sortable = uiSelectConfig.sortable;

            ctrl.removeSelected = false;                // If selected item(s) should be removed from dropdown list
            ctrl.closeOnSelect = true;                  // Initialized inside uiSelect directive link function
            ctrl.search = EMPTY_SEARCH;

            ctrl.activeIndex = 0;                       // Dropdown of choices
            ctrl.items = [];                            // All available choices

            ctrl.open = false;
            ctrl.focus = false;
            ctrl.disabled = false;
            ctrl.selected = undefined;

            ctrl.focusser = undefined;                  // Reference to input element used to handle focus events
            ctrl.resetSearchInput = true;
            ctrl.multiple = undefined;                  // Initialized inside uiSelect directive link function
            ctrl.disableChoiceExpression = undefined;   // Initialized inside uiSelectChoices directive link function
            ctrl.lockChoiceExpression = undefined;      // Initialized inside uiSelectMatch directive link function
            ctrl.clickTriggeredSelect = false;
            ctrl.$filter = $filter;

            ctrl.searchInput = $element.querySelectorAll('input.ui-select-search');
            if (ctrl.searchInput.length !== 1) {
                throw uiSelectMinErr('searchInput', "Expected 1 input.ui-select-search but got '{0}'.",
                    ctrl.searchInput.length);
            }

            // TODO: Maybe make these methods in KEY directly in the controller?
            ctrl.KEY = {
                TAB: 9,
                ENTER: 13,
                ESC: 27,
                SPACE: 32,
                LEFT: 37,
                UP: 38,
                RIGHT: 39,
                DOWN: 40,
                SHIFT: 16,
                CTRL: 17,
                ALT: 18,
                PAGE_UP: 33,
                PAGE_DOWN: 34,
                HOME: 36,
                END: 35,
                BACKSPACE: 8,
                DELETE: 46,
                COMMAND: 91,
                MAP: {
                    91: "COMMAND",
                    8: "BACKSPACE",
                    9: "TAB",
                    13: "ENTER",
                    16: "SHIFT",
                    17: "CTRL",
                    18: "ALT",
                    19: "PAUSEBREAK",
                    20: "CAPSLOCK",
                    27: "ESC",
                    32: "SPACE",
                    33: "PAGE_UP",
                    34: "PAGE_DOWN",
                    35: "END",
                    36: "HOME",
                    37: "LEFT",
                    38: "UP",
                    39: "RIGHT",
                    40: "DOWN",
                    43: "+",
                    44: "PRINTSCREEN",
                    45: "INSERT",
                    46: "DELETE",
                    48: "0",
                    49: "1",
                    50: "2",
                    51: "3",
                    52: "4",
                    53: "5",
                    54: "6",
                    55: "7",
                    56: "8",
                    57: "9",
                    59: ";",
                    61: "=",
                    65: "A",
                    66: "B",
                    67: "C",
                    68: "D",
                    69: "E",
                    70: "F",
                    71: "G",
                    72: "H",
                    73: "I",
                    74: "J",
                    75: "K",
                    76: "L",
                    77: "M",
                    78: "N",
                    79: "O",
                    80: "P",
                    81: "Q",
                    82: "R",
                    83: "S",
                    84: "T",
                    85: "U",
                    86: "V",
                    87: "W",
                    88: "X",
                    89: "Y",
                    90: "Z",
                    96: "0",
                    97: "1",
                    98: "2",
                    99: "3",
                    100: "4",
                    101: "5",
                    102: "6",
                    103: "7",
                    104: "8",
                    105: "9",
                    106: "*",
                    107: "+",
                    109: "-",
                    110: ".",
                    111: "/",
                    112: "F1",
                    113: "F2",
                    114: "F3",
                    115: "F4",
                    116: "F5",
                    117: "F6",
                    118: "F7",
                    119: "F8",
                    120: "F9",
                    121: "F10",
                    122: "F11",
                    123: "F12",
                    144: "NUMLOCK",
                    145: "SCROLLLOCK",
                    186: ";",
                    187: "=",
                    188: ",",
                    189: "-",
                    190: ".",
                    191: "/",
                    192: "`",
                    219: "[",
                    220: "\\",
                    221: "]",
                    222: "'"
                },

                isControl: function (e) {
                    var k = e.which;
                    switch (k) {
                        case ctrl.KEY.COMMAND:
                        case ctrl.KEY.SHIFT:
                        case ctrl.KEY.CTRL:
                        case ctrl.KEY.ALT:
                            return true;
                    }

                    if (e.metaKey) {
                        return true;
                    }

                    return false;
                },
                isFunctionKey: function (k) {
                    k = k.which ? k.which : k;
                    return k >= 112 && k <= 123;
                },
                isVerticalMovement: function (k) {
                    return ~[ctrl.KEY.UP, ctrl.KEY.DOWN].indexOf(k);
                },
                isHorizontalMovement: function (k) {
                    return ~[ctrl.KEY.LEFT, ctrl.KEY.RIGHT, ctrl.KEY.BACKSPACE, ctrl.KEY.DELETE].indexOf(k);
                }
            };

            /**
             * Returns true if the selection is empty
             * @returns {boolean|*}
             */
            ctrl.isEmpty = function () {
                return angular.isUndefined(ctrl.selected) || ctrl.selected === null || ctrl.selected === '';
            };

            // Most of the time the user does not want to empty the search input when in typeahead mode
            function _resetSearchInput() {
                if (ctrl.resetSearchInput || (ctrl.resetSearchInput === undefined && uiSelectConfig.resetSearchInput)) {
                    ctrl.search = EMPTY_SEARCH;
                    // Reset activeIndex
                    if (ctrl.selected && ctrl.items.length && !ctrl.multiple) {
                        ctrl.activeIndex = ctrl.items.indexOf(ctrl.selected);
                    }
                }
            }

            ctrl.findGroupByName = function (name) {
                return ctrl.groups && ctrl.groups.filter(function (group) {
                        return group.name === name;
                    })[0];
            };

            function _groupsFilter(groups, groupNames) {
                var i, j, result = [];
                for (i = 0; i < groupNames.length; i++) {
                    for (j = 0; j < groups.length; j++) {
                        if (groups[j].name == [groupNames[i]]) {
                            result.push(groups[j]);
                        }
                    }
                }
                return result;
            }

            /**
             * Activates the control.
             * When the user clicks on ui-select, displays the dropdown list
             * Also called following keyboard input to the search box
             */
            ctrl.activate = function (initSearchValue, avoidReset) {
                if (!ctrl.disabled && !ctrl.open) {
                    var completeCallback = function () {
                        if (!avoidReset) {
                            _resetSearchInput();
                        }

                        $scope.$broadcast('uis:activate');

                        ctrl.open = true;
                        if (!ctrl.searchEnabled) {
                            angular.element(ctrl.searchInput[0]).addClass('ui-select-offscreen');
                        }

                        ctrl.activeIndex = ctrl.activeIndex >= ctrl.items.length ? 0 : ctrl.activeIndex;

                        // Give it time to appear before focus
                        $timeout(function () {
                            ctrl.search = initSearchValue || ctrl.search;
                            ctrl.searchInput[0].focus();
                        });
                    };

                    var result = ctrl.beforeDropdownOpen();
                    if (angular.isFunction(result.then)) {
                        // Promise returned - wait for it to complete before completing the selection
                        result.then(function (result) {
                            if (result === true) {
                                completeCallback();
                            }
                        });
                    } else if (result === true) {
                        completeCallback();
                    }
                }
                else if (ctrl.open && !ctrl.searchEnabled) {
                    // Close the selection if we don't have search enabled, and we click on the select again
                    ctrl.close();
                }
            };

            ctrl.parseRepeatAttr = function (repeatAttr, groupByExp, groupFilterExp) {
                function updateGroups(items) {
                    var groupFn = $scope.$eval(groupByExp);
                    ctrl.groups = [];
                    angular.forEach(items, function (item) {
                        var groupName = angular.isFunction(groupFn) ? groupFn(item) : item[groupFn];
                        var group = ctrl.findGroupByName(groupName);
                        if (group) {
                            group.items.push(item);
                        }
                        else {
                            ctrl.groups.push({name: groupName, items: [item]});
                        }
                    });
                    if (groupFilterExp) {
                        var groupFilterFn = $scope.$eval(groupFilterExp);
                        if (angular.isFunction(groupFilterFn)) {
                            ctrl.groups = groupFilterFn(ctrl.groups);
                        } else if (angular.isArray(groupFilterFn)) {
                            ctrl.groups = _groupsFilter(ctrl.groups, groupFilterFn);
                        }
                    }
                    ctrl.items = [];
                    ctrl.groups.forEach(function (group) {
                        ctrl.items = ctrl.items.concat(group.items);
                    });
                }

                function setPlainItems(items) {
                    ctrl.items = items;
                }

                // Set the function to use when displaying items - either groups or single
                ctrl.setItemsFn = groupByExp ? updateGroups : setPlainItems;

                ctrl.parserResult = RepeatParser.parse(repeatAttr);

                ctrl.isGrouped = !!groupByExp;
                ctrl.itemProperty = ctrl.parserResult.itemName;

                ctrl.refreshItems = function (data) {
                    data = data || ctrl.parserResult.source($scope);
                    var selectedItems = ctrl.selected;
                    // TODO should implement for single mode removeSelected
                    if (ctrl.isEmpty() || (angular.isArray(selectedItems) && !selectedItems.length) ||
                        !ctrl.removeSelected) {
                        ctrl.setItemsFn(data);
                    } else {
                        if (data !== undefined) {
                            var filteredItems = data.filter(function (i) {
                                return selectedItems.indexOf(i) < 0;
                            });
                            ctrl.setItemsFn(filteredItems);
                        }
                    }
                };

                // See https://github.com/angular/angular.js/blob/v1.2.15/src/ng/directive/ngRepeat.js#L259
                $scope.$watchCollection(ctrl.parserResult.source, function (items) {
                    if (items === undefined || items === null) {
                        // If the user specifies undefined or null => reset the collection
                        // Special case: items can be undefined if the user did not initialized the collection on the scope
                        // i.e $scope.addresses = [] is missing
                        ctrl.items = [];
                    } else {
                        if (!angular.isArray(items)) {
                            throw uiSelectMinErr('items', "Expected an array but got '{0}'.", items);
                        } else {
                            // Remove already selected items (ex: while searching)
                            // TODO Should add a test
                            ctrl.refreshItems(items);
                            // Force scope model value and ngModel value to be out of sync to re-run formatters
                            ctrl.ngModel.$modelValue = null;
                        }
                    }
                });
            };

            ctrl.setActiveItem = function (item) {
                ctrl.activeIndex = ctrl.items.indexOf(item);
            };

            /**
             * Checks if the item is active
             * @param itemScope the item
             * @returns {boolean} true if active
             */
            ctrl.isActive = function (itemScope) {
                if (!ctrl.open) {
                    return false;
                }
                // Get the index of this item - returns -1 if the item isn't in the current list
                var itemIndex = ctrl.items.indexOf(itemScope[ctrl.itemProperty]);

                // Is this the active index?
                // If the itemIndex is -1, then the item wasn't in the list so let's ensure we're not active
                // otherwise we can end up with all items being selected as active!
                var isActive = itemIndex === -1 ? false : itemIndex === ctrl.activeIndex;

                // If this is active, and we've defined a callback, do it!
                // TODO: Is this needed? If it is, then implement properly.
//                if (isActive && !angular.isUndefined(ctrl.onHighlightCallback)) {
//                    itemScope.$eval(ctrl.onHighlightCallback);
//                }

                return isActive;
            };

            /**
             * Checks if the item is disabled
             * @param itemScope the item
             * @return {boolean} true if the item is disabled
             */
            ctrl.isDisabled = function (itemScope) {
                if (!ctrl.open) {
                    return false;
                }

                var itemIndex = ctrl.items.indexOf(itemScope[ctrl.itemProperty]);
                var isDisabled = false;
                var item;

                if (itemIndex >= 0 && !angular.isUndefined(ctrl.disableChoiceExpression)) {
                    item = ctrl.items[itemIndex];
                    // Force the boolean value
                    isDisabled = !!(itemScope.$eval(ctrl.disableChoiceExpression));
                    // Store this for later reference
                    item._uiSelectChoiceDisabled = isDisabled;
                }

                return isDisabled;
            };

            /**
             * Selects an item. Calls the onBeforeSelect and onSelect callbacks
             * onBeforeSelect is called to allow the user to alter or abort the selection
             * onSelect is called to notify the user of the selection
             *
             * Called when the user selects an item with ENTER or clicks the dropdown
             */
            ctrl.select = function (item, skipFocusser, $event) {
                if (item !== undefined && item._uiSelectChoiceDisabled) {
                    return;
                }

                // If no items in the list, and no search, then return
                if (!ctrl.items && !ctrl.search) {
                    return;
                }

                function completeCallback() {
                    $scope.$broadcast('uis:select', item);

                    $timeout(function () {
                        ctrl.afterSelect(item);
                    });

                    if (ctrl.closeOnSelect) {
                        ctrl.close(skipFocusser);
                    }
                    if ($event && $event.type === 'click') {
                        ctrl.clickTriggeredSelect = true;
                    }
                }

                // Call the beforeSelect method
                // Allowable responses are -:
                // false: Abort the selection
                // true: Complete selection
                // promise: Wait for response
                // object: Add the returned object
                var result = ctrl.beforeSelect(item);
                if (angular.isFunction(result.then)) {
                    // Promise returned - wait for it to complete before completing the selection
                    result.then(function (response) {
                        if (!response) {
                            return;
                        }
                        if (response === true) {
                            completeCallback(item);
                        } else if (response) {
                            completeCallback(response);
                        }
                    });
                } else if (result === true) {
                    completeCallback(item);
                } else if (result) {
                    completeCallback(result);
                }
            };

            /**
             * Close the dropdown
             */
            ctrl.close = function (skipFocusser) {
                if (!ctrl.open) {
                    return;
                }

                function completeCallback() {
                    if (ctrl.ngModel && ctrl.ngModel.$setTouched) {
                        ctrl.ngModel.$setTouched();
                    }
                    _resetSearchInput();
                    ctrl.open = false;
                    if (!ctrl.searchEnabled) {
                        angular.element(ctrl.searchInput[0]).removeClass('ui-select-offscreen');
                    }

                    $scope.$broadcast('uis:close', skipFocusser);
                }

                var result = ctrl.beforeDropdownClose();
                if (angular.isFunction(result.then)) {
                    // Promise returned - wait for it to complete before completing the selection
                    result.then(function (result) {
                        if (result === true) {
                            completeCallback();
                        }
                    });
                } else if (result === true) {
                    completeCallback();
                }
            };

            /**
             *  Set focus on the control
             */
            ctrl.setFocus = function () {
                if (!ctrl.focus) {
                    ctrl.focusInput[0].focus();
                }
            };

            /**
             * Clears the selection
             * @param $event
             */
            ctrl.clear = function ($event) {
                ctrl.select(undefined);
                $event.stopPropagation();
                $timeout(function () {
                    ctrl.focusser[0].focus();
                }, 0, false);
            };

            /**
             * Toggle the dropdown open and closed
             */
            ctrl.toggle = function (e) {
                if (ctrl.open) {
                    ctrl.close();
                    e.preventDefault();
                    e.stopPropagation();
                } else {
                    ctrl.activate();
                }
            };

            ctrl.isLocked = function (itemScope, itemIndex) {
                var isLocked, item = ctrl.selected[itemIndex];

                if (item && !angular.isUndefined(ctrl.lockChoiceExpression)) {
                    // Force the boolean value
                    isLocked = !!(itemScope.$eval(ctrl.lockChoiceExpression));
                    // Store this for later reference
                    item._uiSelectChoiceLocked = isLocked;
                }

                return isLocked;
            };

            var sizeWatch = null;
            ctrl.sizeSearchInput = function () {
                var input = ctrl.searchInput[0],
                    container = ctrl.searchInput.parent().parent()[0],
                    calculateContainerWidth = function () {
                        // Return the container width only if the search input is visible
                        return container.clientWidth * !!input.offsetParent;
                    },
                    updateIfVisible = function (containerWidth) {
                        if (containerWidth === 0) {
                            return false;
                        }
                        var inputWidth = containerWidth - input.offsetLeft - ctrl.searchInput.parent()[0].offsetLeft -
                            5;
                        if (inputWidth < 50) {
                            inputWidth = containerWidth;
                        }
                        ctrl.searchInput.css('width', inputWidth + 'px');
                        return true;
                    };

                ctrl.searchInput.css('width', '10px');
                $timeout(function () {
                    // Give time to render correctly
                    if (sizeWatch === null && !updateIfVisible(calculateContainerWidth())) {
                        sizeWatch = $scope.$watch(calculateContainerWidth, function (containerWidth) {
                            if (updateIfVisible(containerWidth)) {
                                sizeWatch();
                                sizeWatch = null;
                            }
                        });
                    }
                });
            };

            function _handleDropDownSelection(key) {
                var processed = true;
                switch (key) {
                    case ctrl.KEY.DOWN:
                        if (!ctrl.open && ctrl.multiple) {
                            // In case its the search input in 'multiple' mode
                            ctrl.activate(false, true);
                        }
                        else if (ctrl.activeIndex < ctrl.items.length - 1) {
                            ctrl.activeIndex++;
                        }
                        break;
                    case ctrl.KEY.UP:
                        if (!ctrl.open && ctrl.multiple) {
                            ctrl.activate(false, true);
                        } //In case its the search input in 'multiple' mode
                        else if (ctrl.activeIndex > 0) {
                            ctrl.activeIndex--;
                        }
                        break;
                    case ctrl.KEY.TAB:
                        if (!ctrl.multiple || ctrl.open) {
                            ctrl.select(ctrl.items[ctrl.activeIndex], true);
                        }
                        break;
                    case ctrl.KEY.ENTER:
                        if (ctrl.open) {
                            // Make sure at least one dropdown item is highlighted before adding
                            if (ctrl.items[ctrl.activeIndex] !== undefined) {
                                ctrl.select(ctrl.items[ctrl.activeIndex]);
                            }
                        } else {
                            // In case its the search input in 'multiple' mode
                            ctrl.activate(false, true);
                        }
                        break;
                    case ctrl.KEY.ESC:
                        ctrl.close();
                        break;
                    default:
                        processed = false;
                }
                return processed;
            }

            // Bind to keyboard shortcuts
            ctrl.searchInput.on('keydown', function (e) {
                var key = e.which;

                if (~[ctrl.KEY.ESC, ctrl.KEY.TAB].indexOf(key)) {
                    // TODO: SEGURO?
                    ctrl.close();
                }

                $scope.$apply(function () {
                    _handleDropDownSelection(key);
                });

                if (ctrl.KEY.isVerticalMovement(key) && ctrl.items.length > 0) {
                    _ensureHighlightVisible();
                }

                if (key === ctrl.KEY.ENTER || key === ctrl.KEY.ESC) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });

            ctrl.searchInput.on('keyup', function (e) {
                // return early with these keys
                if (e.which === ctrl.KEY.TAB || ctrl.KEY.isControl(e) || ctrl.KEY.isFunctionKey(e) ||
                    e.which === ctrl.KEY.ESC ||
                    ctrl.KEY.isVerticalMovement(e.which)) {
                    return;
                }

                // Let the users process the data
                // TODO: Is this needed, or just let the user bind to the event themselves!
                ctrl.afterKeypress(e);
            });

            // See https://github.com/ivaynberg/select2/blob/3.4.6/select2.js#L1431
            function _ensureHighlightVisible() {
                var container = $element.querySelectorAll('.ui-select-choices-content');
                var choices = container.querySelectorAll('.ui-select-choices-row');
                if (choices.length < 1) {
                    throw uiSelectMinErr('choices', "Expected multiple .ui-select-choices-row but got '{0}'.",
                        choices.length);
                }

                if (ctrl.activeIndex < 0) {
                    return;
                }

                var highlighted = choices[ctrl.activeIndex];
                var posY = highlighted.offsetTop + highlighted.clientHeight - container[0].scrollTop;
                var height = container[0].offsetHeight;

                if (posY > height) {
                    container[0].scrollTop += posY - height;
                } else if (posY < highlighted.clientHeight) {
                    if (ctrl.isGrouped && ctrl.activeIndex === 0) {
                        // To make group header visible when going all the way up
                        container[0].scrollTop = 0;
                    }
                    else {
                        container[0].scrollTop -= highlighted.clientHeight - posY;
                    }
                }
            }

            $scope.$on('$destroy', function () {
                ctrl.searchInput.off('keyup keydown blur paste');
            });

            /**
             * Keypress callback. Overridable.
             * @param event the keypress event
             */
            /* jshint unused:false */
            ctrl.afterKeypress = function (event) {
            };

            /**
             * Method called before a selection is made. This can be overridden to allow
             * the selection to be aborted, or a modified version of the selected item to be
             * returned.
             *
             * Allowable responses are -:
             * false: Abort the selection
             * true: Complete selection with the selected object
             * object: Complete the selection with the returned object
             * promise: Wait for response - response from promise is as above
             *
             * @param item the item that has been selected
             * @returns {*}
             */
            ctrl.beforeSelect = function (item) {
                return true;
            };

            /**
             * Method called after a selection is confirmed. This can be overridden to allow
             * the application to be notified of a newly selected item.
             * No return is required.
             *
             * @param item the item that has been selected
             */
            ctrl.afterSelect = function (item) {
            };

            /**
             * Method called before an item is removed from the selected list. This can be overridden
             * to allow the removal to be aborted
             *
             * Allowable responses are -:
             * false: Abort the selection
             * true: Complete selection with the selected object
             * object: Complete the selection with the returned object
             * promise: Wait for response - response from promise is as above
             *
             * @param item the item that has been selected
             * @returns {*}
             */
            ctrl.beforeRemove = function (item) {
                return true;
            };

            /**
             * Method called after a item is removed. This can be overridden to allow
             * the application to be notified of a removed item.
             * No return is required.
             *
             * @param item the item that has been removed
             */
            ctrl.afterRemove = function (item) {
            };

            /**
             * Method called before the dropdown is opened. This can be overridden to allow
             * the application to process data before the dropdown is displayed.
             * The method may return a promise, or true to allow the dropdown, or false to abort.
             * @returns {boolean}
             */
            ctrl.beforeDropdownOpen = function () {
                return true;
            };

            /**
             * Method called before the dropdown is closed. This can be overridden to allow
             * the application to prevent the dropdown from closing.
             * The method may return a promise, or true to allow the dropdown to close, or false to abort.
             * @returns {boolean}
             */
            ctrl.beforeDropdownClose = function () {
                return true;
            };

        }]);

uis.directive('uiSelect',
    ['$document', '$window', 'uiSelectConfig', 'uiSelectMinErr', 'uisOffset', '$compile', '$parse', '$timeout',
        function ($document, $window, uiSelectConfig, uiSelectMinErr, uisOffset, $compile, $parse, $timeout) {

            return {
                restrict: 'EA',
                templateUrl: function (tElement, tAttrs) {
                    var theme = tAttrs.theme || uiSelectConfig.theme;
                    return theme +
                        (angular.isDefined(tAttrs.multiple) ? '/select-multiple.tpl.html' : '/select.tpl.html');
                },
                replace: true,
                transclude: true,
                require: ['uiSelect', '^ngModel'],
                scope: true,
                controller: 'uiSelectCtrl',
                controllerAs: '$select',
                compile: function (tElement, tAttrs) {

                    // Multiple or Single depending if multiple attribute presence
                    if (angular.isDefined(tAttrs.multiple)) {
                        tElement.append("<ui-select-multiple/>").removeAttr('multiple');
                    }
                    else {
                        tElement.append("<ui-select-single/>");
                    }

                    return function (scope, element, attrs, ctrls, transcludeFn) {
                        var $select = ctrls[0];
                        var ngModel = ctrls[1];

                        $select.generatedId = uiSelectConfig.generateId();
                        $select.baseTitle = attrs.title || 'Select box';
                        $select.focusserTitle = $select.baseTitle + ' focus';
                        $select.focusserId = 'focusser-' + $select.generatedId;

                        $select.closeOnSelect = function () {
                            if (angular.isDefined(attrs.closeOnSelect)) {
                                return $parse(attrs.closeOnSelect)();
                            } else {
                                return uiSelectConfig.closeOnSelect;
                            }
                        }();

                        // Limit the number of selections allowed
                        $select.limit = (angular.isDefined(attrs.limit)) ? parseInt(attrs.limit, 10) : undefined;

                        // Set reference to ngModel from uiSelectCtrl
                        $select.ngModel = ngModel;

                        $select.choiceGrouped = function (group) {
                            return $select.isGrouped && group && group.name;
                        };

                        if (attrs.tabindex) {
                            attrs.$observe('tabindex', function (value) {
                                $select.focusInput.attr("tabindex", value);
                                element.removeAttr("tabindex");
                            });
                        }

                        var searchEnabled = scope.$eval(attrs.searchEnabled);
                        $select.searchEnabled =
                            searchEnabled !== undefined ? searchEnabled : uiSelectConfig.searchEnabled;

                        var sortable = scope.$eval(attrs.sortable);
                        $select.sortable = sortable !== undefined ? sortable : uiSelectConfig.sortable;

                        attrs.$observe('disabled', function () {
                            // No need to use $eval() (thanks to ng-disabled) since we already get a boolean instead of a string
                            $select.disabled = attrs.disabled !== undefined ? attrs.disabled : false;
                        });


                        //Automatically gets focus when loaded
                        if (angular.isDefined(attrs.autofocus)) {
                            $timeout(function () {
                                $select.setFocus();
                            });
                        }

                        // Gets focus based on scope event name (e.g. focus-on='SomeEventName')
                        if (angular.isDefined(attrs.focusOn)) {
                            scope.$on(attrs.focusOn, function () {
                                $timeout(function () {
                                    $select.setFocus();
                                });
                            });
                        }

                        function onDocumentClick(e) {
                            //Skip it if dropdown is close
                            if (!$select.open) {
                                return;
                            }

                            var contains = false;

                            if (window.jQuery) {
                                // Firefox 3.6 does not support element.contains()
                                // See Node.contains https://developer.mozilla.org/en-US/docs/Web/API/Node.contains
                                contains = window.jQuery.contains(element[0], e.target);
                            } else {
                                contains = element[0].contains(e.target);
                            }

                            if (!contains && !$select.clickTriggeredSelect) {
                                // Will lose focus only with certain targets
                                var focusableControls = ['input', 'button', 'textarea'];
                                // To check if target is other ui-select
                                var targetController = angular.element(e.target).controller('uiSelect');
                                // To check if target is other ui-select
                                var skipFocusser = targetController && targetController !== $select;
                                // Check if target is input, button or textarea
                                if (!skipFocusser) {
                                    skipFocusser = ~focusableControls.indexOf(e.target.tagName.toLowerCase());
                                }
                                $select.close(skipFocusser);
                                scope.$digest();
                            }
                            $select.clickTriggeredSelect = false;
                        }

                        // See Click everywhere but here event http://stackoverflow.com/questions/12931369
                        $document.on('click', onDocumentClick);

                        scope.$on('$destroy', function () {
                            $document.off('click', onDocumentClick);
                        });

                        // Move transcluded elements to their correct position in main template
                        transcludeFn(scope, function (clone) {
                            // See Transclude in AngularJS http://blog.omkarpatil.com/2012/11/transclude-in-angularjs.html

                            // One day jqLite will be replaced by jQuery and we will be able to write:
                            // var transcludedElement = clone.filter('.my-class')
                            // instead of creating a hackish DOM element:
                            var transcluded = angular.element('<div>').append(clone);

                            var transcludedMatch = transcluded.querySelectorAll('.ui-select-match');
                            transcludedMatch.removeAttr('ui-select-match'); //To avoid loop in case directive as attr
                            transcludedMatch.removeAttr('data-ui-select-match'); // Properly handle HTML5 data-attributes
                            if (transcludedMatch.length !== 1) {
                                throw uiSelectMinErr('transcluded', "Expected 1 .ui-select-match but got '{0}'.",
                                    transcludedMatch.length);
                            }
                            element.querySelectorAll('.ui-select-match').replaceWith(transcludedMatch);

                            var transcludedChoices = transcluded.querySelectorAll('.ui-select-choices');
                            transcludedChoices.removeAttr('ui-select-choices'); //To avoid loop in case directive as attr
                            transcludedChoices.removeAttr('data-ui-select-choices'); // Properly handle HTML5 data-attributes
                            if (transcludedChoices.length !== 1) {
                                throw uiSelectMinErr('transcluded', "Expected 1 .ui-select-choices but got '{0}'.",
                                    transcludedChoices.length);
                            }
                            element.querySelectorAll('.ui-select-choices').replaceWith(transcludedChoices);
                        });

                        // Support for appending the select field to the body when its open
                        var appendToBody = scope.$eval(attrs.appendToBody);
                        if (appendToBody !== undefined ? appendToBody : uiSelectConfig.appendToBody) {
                            scope.$watch('$select.open', function (isOpen) {
                                if (isOpen) {
                                    positionDropdown();
                                } else {
                                    resetDropdown();
                                }
                            });

                            // Move the dropdown back to its original location when the scope is destroyed. Otherwise
                            // it might stick around when the user routes away or the select field is otherwise removed
                            scope.$on('$destroy', function () {
                                resetDropdown();
                            });
                        }

                        // Hold on to a reference to the .ui-select-container element for appendToBody support
                        var placeholder = null,
                            originalWidth = '';

                        function positionDropdown() {
                            // Remember the absolute position of the element
                            var offset = uisOffset(element);

                            // Clone the element into a placeholder element to take its original place in the DOM
                            placeholder = angular.element('<div class="ui-select-placeholder"></div>');
                            placeholder[0].style.width = offset.width + 'px';
                            placeholder[0].style.height = offset.height + 'px';
                            element.after(placeholder);

                            // Remember the original value of the element width inline style, so it can be restored
                            // when the dropdown is closed
                            originalWidth = element[0].style.width;

                            // Now move the actual dropdown element to the end of the body
                            $document.find('body').append(element);

                            element[0].style.position = 'absolute';
                            element[0].style.left = offset.left + 'px';
                            element[0].style.top = offset.top + 'px';
                            element[0].style.width = offset.width + 'px';
                        }

                        function resetDropdown() {
                            if (placeholder === null) {
                                // The dropdown has not actually been display yet, so there's nothing to reset
                                return;
                            }

                            // Move the dropdown element back to its original location in the DOM
                            placeholder.replaceWith(element);
                            placeholder = null;

                            element[0].style.position = '';
                            element[0].style.left = '';
                            element[0].style.top = '';
                            element[0].style.width = originalWidth;
                        }

                        // Hold on to a reference to the .ui-select-dropdown element for direction support.
                        var dropdown = null,
                            directionUpClassName = 'direction-up';

                        // Support changing the direction of the dropdown if there isn't enough space to render it.
                        scope.$watch('$select.open', function (isOpen) {
                            if (isOpen) {
                                // Get the dropdown element
                                dropdown = angular.element(element).querySelectorAll('.ui-select-dropdown');
                                if (dropdown === null) {
                                    return;
                                }

                                // Hide the dropdown so there is no flicker until $timeout is done executing.
                                dropdown[0].style.opacity = 0;

                                // Delay positioning the dropdown until all choices have been added so its height is correct.
                                $timeout(function () {
                                    var offset = uisOffset(element);
                                    var offsetDropdown = uisOffset(dropdown);

                                    // Determine if the direction of the dropdown needs to be changed.
                                    if (offset.top + offset.height + offsetDropdown.height >
                                        $window.pageYOffset + $document[0].documentElement.clientHeight) {
                                        element.addClass(directionUpClassName);
                                    }

                                    // Display the dropdown once it has been positioned.
                                    dropdown[0].style.opacity = 1;
                                });
                            } else {
                                if (dropdown === null) {
                                    return;
                                }

                                // Reset the position of the dropdown.
                                element.removeClass(directionUpClassName);
                            }
                        });
                    };
                }
            };
        }]);

uis.directive('uiSelectMatch', ['uiSelectConfig', function (uiSelectConfig) {
    return {
        restrict: 'EA',
        require: '^uiSelect',
        replace: true,
        transclude: true,
        templateUrl: function (tElement) {
            // Gets theme attribute from parent (ui-select)
            var theme = tElement.parent().attr('theme') || uiSelectConfig.theme;
            var multi = tElement.parent().attr('multiple');
            return theme + (multi ? '/match-multiple.tpl.html' : '/match.tpl.html');
        },
        link: function (scope, element, attrs, $select) {
            $select.lockChoiceExpression = attrs.uiLockChoice;

            // TODO: observe required?
            attrs.$observe('placeholder', function (placeholder) {
                $select.placeholder = placeholder !== undefined ? placeholder : uiSelectConfig.placeholder;
            });

            function setAllowClear(allow) {
                $select.allowClear =
                    (angular.isDefined(allow)) ? (allow === '') ? true : (allow.toLowerCase() === 'true') : false;
            }

            // TODO: observe required?
            attrs.$observe('allowClear', setAllowClear);
            setAllowClear(attrs.allowClear);

            if ($select.multiple) {
                $select.sizeSearchInput();
            }
        }
    };
}]);

uis.directive('uiSelectMultiple', ['uiSelectMinErr', '$timeout', function (uiSelectMinErr, $timeout) {
    return {
        restrict: 'EA',
        require: ['^uiSelect', '^ngModel'],
        controller: ['$scope', '$timeout', function ($scope, $timeout) {
            var ctrl = this,
                $select = $scope.$select,
                ngModel;

            //Wait for link fn to inject it
            $scope.$evalAsync(function () {
                ngModel = $scope.ngModel;
            });

            ctrl.activeMatchIndex = -1;

            ctrl.updateModel = function () {
                ngModel.$setViewValue(Date.now()); //Set timestamp as a unique string to force changes
                ctrl.refreshComponent();
            };

            ctrl.refreshComponent = function () {
                // Remove already selected items
                // e.g. When user clicks on a selection, the selected array changes and
                // the dropdown should remove that item
                $select.refreshItems();
                $select.sizeSearchInput();
            };

            /**
             * Remove item from multiple select
             * Calls onBeforeRemove to allow the user to prevent the removal of the item
             * Then calls onRemove to notify the user the item has been removed
             */
            ctrl.removeChoice = function (index) {
                // Get the removed choice
                var removedChoice = $select.selected[index];

                // If the choice is locked, can't remove it
                if (removedChoice._uiSelectChoiceLocked) {
                    return;
                }

                // Give some time for scope propagation.
                function completeCallback() {
                    $select.selected.splice(index, 1);
                    ctrl.activeMatchIndex = -1;
                    $select.sizeSearchInput();

                    $timeout(function () {
                        $select.afterRemove(removedChoice);
                    });

                    ctrl.updateModel();
                }

                // Call the beforeRemove callback
                // Allowable responses are -:
                // false: Abort the removal
                // true: Complete removal
                // promise: Wait for response
                var result = $select.beforeRemove(removedChoice);
                if (angular.isFunction(result.then)) {
                    // Promise returned - wait for it to complete before completing the selection
                    result.then(function (result) {
                        if (result === true) {
                            completeCallback();
                        }
                    });
                } else if (result === true) {
                    completeCallback();
                }
            };

            ctrl.getPlaceholder = function () {
                // Refactor single?
                if ($select.selected && $select.selected.length) {
                    return;
                }
                return $select.placeholder;
            };
        }],
        controllerAs: '$selectMultiple',

        link: function (scope, element, attrs, ctrls) {
            var $select = ctrls[0];
            var ngModel = scope.ngModel = ctrls[1];
            var $selectMultiple = scope.$selectMultiple;

            //$select.selected = raw selected objects (ignoring any property binding)

            $select.multiple = true;
            $select.removeSelected = true;

            //Input that will handle focus
            $select.focusInput = $select.searchInput;

            //From view --> model
            ngModel.$parsers.unshift(function () {
                var locals = {},
                    result,
                    resultMultiple = [];
                for (var j = $select.selected.length - 1; j >= 0; j--) {
                    locals = {};
                    locals[$select.parserResult.itemName] = $select.selected[j];
                    result = $select.parserResult.modelMapper(scope, locals);
                    resultMultiple.unshift(result);
                }
                return resultMultiple;
            });

            // From model --> view
            ngModel.$formatters.unshift(function (inputValue) {
                var data = $select.parserResult.source(scope, {$select: {search: ''}}), //Overwrite $search
                    locals = {},
                    result;
                if (!data) {
                    return inputValue;
                }
                var resultMultiple = [];
                var checkFnMultiple = function (list, value) {
                    if (!list || !list.length) {
                        return;
                    }
                    for (var p = list.length - 1; p >= 0; p--) {
                        locals[$select.parserResult.itemName] = list[p];
                        result = $select.parserResult.modelMapper(scope, locals);
                        if ($select.parserResult.trackByExp) {
                            var matches = /\.(.+)/.exec($select.parserResult.trackByExp);
                            if (matches.length > 0 && result[matches[1]] == value[matches[1]]) {
                                resultMultiple.unshift(list[p]);
                                return true;
                            }
                        }
                        if (angular.equals(result, value)) {
                            resultMultiple.unshift(list[p]);
                            return true;
                        }
                    }
                    return false;
                };
                if (!inputValue) return resultMultiple; //If ngModel was undefined
                for (var k = inputValue.length - 1; k >= 0; k--) {
                    //Check model array of currently selected items
                    if (!checkFnMultiple($select.selected, inputValue[k])) {
                        //Check model array of all items available
                        if (!checkFnMultiple(data, inputValue[k])) {
                            //If not found on previous lists, just add it directly to resultMultiple
                            resultMultiple.unshift(inputValue[k]);
                        }
                    }
                }
                return resultMultiple;
            });

            //Watch for external model changes
            scope.$watchCollection(function () {
                return ngModel.$modelValue;
            }, function (newValue, oldValue) {
                if (oldValue != newValue) {
                    ngModel.$modelValue = null; //Force scope model value and ngModel value to be out of sync to re-run formatters
                    $selectMultiple.refreshComponent();
                }
            });

            ngModel.$render = function () {
                // Make sure that model value is array
                if (!angular.isArray(ngModel.$viewValue)) {
                    // Have tolerance for null or undefined values
                    if (angular.isUndefined(ngModel.$viewValue) || ngModel.$viewValue === null) {
                        $select.selected = [];
                    } else {
                        throw uiSelectMinErr('multiarr', "Expected model value to be array but got '{0}'",
                            ngModel.$viewValue);
                    }
                }
                $select.selected = ngModel.$viewValue;
                scope.$evalAsync(); //To force $digest
            };

            scope.$on('uis:select', function (event, item) {
                if ($select.selected.length >= $select.limit) {
                    return;
                }
                $select.selected.push(item);
                $selectMultiple.updateModel();
            });

            scope.$on('uis:activate', function () {
                $selectMultiple.activeMatchIndex = -1;
            });

            scope.$watch('$select.disabled', function (newValue, oldValue) {
                // As the search input field may now become visible, it may be necessary to recompute its size
                if (oldValue && !newValue) {
                    $select.sizeSearchInput();
                }
            });

            $select.searchInput.on('keydown', function (e) {
                var key = e.which;
                scope.$apply(function () {
                    var processed = false;
                    if ($select.KEY.isHorizontalMovement(key)) {
                        processed = _handleMatchSelection(key);
                    }
                    if (processed && key != $select.KEY.TAB) {
                        // TODO Check si el tab selecciona aun correctamente
                        //Creat test
//            e.preventDefault();
                        //          e.stopPropagation();
                    }
                });
            });

            function _getCaretPosition(el) {
                if (angular.isNumber(el.selectionStart)) {
                    return el.selectionStart;
                }
                // selectionStart is not supported in IE8 and we don't want hacky workarounds so we compromise
                else {
                    return el.value.length;
                }
            }

            // Handles selected options in "multiple" mode
            function _handleMatchSelection(key) {
                var caretPosition = _getCaretPosition($select.searchInput[0]),
                    length = $select.selected.length,
                    first = 0,
                    last = length - 1,
                    curr = $selectMultiple.activeMatchIndex,
                    next = $selectMultiple.activeMatchIndex + 1,
                    prev = $selectMultiple.activeMatchIndex - 1,
                    newIndex = curr;

                if (caretPosition > 0 || ($select.search.length && key == $select.KEY.RIGHT)) {
                    return false;
                }

                $select.close();

                function getNewActiveMatchIndex() {
                    switch (key) {
                        case $select.KEY.LEFT:
                            // Select previous/first item
                            if (~$selectMultiple.activeMatchIndex) {
                                return prev;
                            }
                            // Select last item
                            else {
                                return last;
                            }
                            break;
                        case $select.KEY.RIGHT:
                            // Open drop-down
                            if (!~$selectMultiple.activeMatchIndex || curr === last) {
                                $select.activate();
                                return false;
                            }
                            // Select next/last item
                            else {
                                return next;
                            }
                            break;
                        case $select.KEY.BACKSPACE:
                            // Remove selected item and select previous/first
                            if (~$selectMultiple.activeMatchIndex) {
                                $selectMultiple.removeChoice(curr);
                                return prev;
                            }
                            // Select last item
                            else {
                                return last;
                            }
                            break;
                        case $select.KEY.DELETE:
                            // Remove selected item and select next item
                            if (~$selectMultiple.activeMatchIndex) {
                                $selectMultiple.removeChoice($selectMultiple.activeMatchIndex);
                                return curr;
                            }
                            else {
                                return false;
                            }
                    }
                }

                newIndex = getNewActiveMatchIndex();

                if (!$select.selected.length || newIndex === false) {
                    $selectMultiple.activeMatchIndex = -1;
                }
                else {
                    $selectMultiple.activeMatchIndex = Math.min(last, Math.max(first, newIndex));
                }

                return true;
            }

            $select.searchInput.on('blur', function () {
                $timeout(function () {
                    $selectMultiple.activeMatchIndex = -1;
                });
            });

        }
    };
}]);

uis.directive('uiSelectSingle', ['$timeout', '$compile', function ($timeout, $compile) {
    return {
        restrict: 'EA',
        require: ['^uiSelect', '^ngModel'],
        link: function (scope, element, attrs, ctrls) {

            var $select = ctrls[0];
            var ngModel = ctrls[1];

            // From view --> model
            ngModel.$parsers.unshift(function (inputValue) {
                var locals = {},
                    result;
                locals[$select.parserResult.itemName] = inputValue;
                result = $select.parserResult.modelMapper(scope, locals);
                return result;
            });

            // From model --> view
            ngModel.$formatters.unshift(function (inputValue) {
                var data = $select.parserResult.source(scope, {$select: {search: ''}}), //Overwrite $search
                    locals = {},
                    result;
                if (data) {
                    var checkFnSingle = function (d) {
                        locals[$select.parserResult.itemName] = d;
                        result = $select.parserResult.modelMapper(scope, locals);
                        return result == inputValue;
                    };
                    // If possible pass same object stored in $select.selected
                    if ($select.selected && checkFnSingle($select.selected)) {
                        return $select.selected;
                    }
                    for (var i = data.length - 1; i >= 0; i--) {
                        if (checkFnSingle(data[i])) {
                            return data[i];
                        }
                    }
                }
                return inputValue;
            });

            // Update viewValue if model change
            scope.$watch('$select.selected', function (newValue) {
                if (ngModel.$viewValue !== newValue) {
                    ngModel.$setViewValue(newValue);
                }
            });

            ngModel.$render = function () {
                $select.selected = ngModel.$viewValue;
            };

            scope.$on('uis:select', function (event, item) {
                $select.selected = item;
            });

            scope.$on('uis:close', function (event, skipFocusser) {
                $timeout(function () {
                    $select.focusser.prop('disabled', false);
                    if (!skipFocusser) $select.focusser[0].focus();
                }, 0, false);
            });

            scope.$on('uis:activate', function () {
                // Will reactivate it on .close()
                focusser.prop('disabled', true);
            });

            // Idea from: https://github.com/ivaynberg/select2/blob/79b5bf6db918d7560bdd959109b7bcfb47edaf43/select2.js#L1954
            var focusser = angular.element("<input ng-disabled='$select.disabled' class='ui-select-focusser ui-select-offscreen' type='text' id='{{ $select.focusserId }}' aria-label='{{ $select.focusserTitle }}' aria-haspopup='true' role='button' />");
            $compile(focusser)(scope);
            $select.focusser = focusser;

            // Input that will handle focus
            $select.focusInput = focusser;

            element.parent().append(focusser);
            focusser.bind("focus", function () {
                scope.$evalAsync(function () {
                    $select.focus = true;
                });
            });
            focusser.bind("blur", function () {
                scope.$evalAsync(function () {
                    $select.focus = false;
                });
            });

            focusser.bind("keydown", function (e) {
                if (e.which === $select.KEY.BACKSPACE) {
                    e.preventDefault();
                    e.stopPropagation();
                    $select.select(undefined);
                    scope.$apply();
                    return;
                }

                if (e.which === $select.KEY.TAB || $select.KEY.isControl(e) || $select.KEY.isFunctionKey(e) || e.which === $select.KEY.ESC) {
                    return;
                }

                if (e.which == $select.KEY.DOWN || e.which == $select.KEY.UP || e.which == $select.KEY.ENTER || e.which == $select.KEY.SPACE) {
                    e.preventDefault();
                    e.stopPropagation();
                    $select.activate();
                }

                scope.$digest();
            });

            focusser.bind("keyup input", function (e) {
                if (e.which === $select.KEY.TAB || $select.KEY.isControl(e) || $select.KEY.isFunctionKey(e) || e.which === $select.KEY.ESC ||
                    e.which == $select.KEY.ENTER || e.which === $select.KEY.BACKSPACE) {
                    return;
                }

                // User pressed some regular key, so we pass it to the search input
                $select.activate(focusser.val());
                focusser.val('');
                scope.$digest();
            });
        }
    };
}]);
/**
 * Parses "repeat" attribute.
 *
 * Taken from AngularJS ngRepeat source code
 * See https://github.com/angular/angular.js/blob/v1.2.15/src/ng/directive/ngRepeat.js#L211
 *
 * Original discussion about parsing "repeat" attribute instead of fully relying on ng-repeat:
 * https://github.com/angular-ui/ui-select/commit/5dd63ad#commitcomment-5504697
 */

uis.service('uisRepeatParser', ['uiSelectMinErr', '$parse', function (uiSelectMinErr, $parse) {
    var self = this;

    /**
     * Example:
     * expression = "address in addresses | filter: {street: $select.search} track by $index"
     * itemName = "address",
     * source = "addresses | filter: {street: $select.search}",
     * trackByExp = "$index",
     */
    self.parse = function (expression) {

        var match = expression.match(/^\s*(?:([\s\S]+?)\s+as\s+)?([\S]+?)\s+in\s+([\s\S]+?)(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);

        if (!match) {
            throw uiSelectMinErr('iexp',
                "Expected expression in form of '_item_ in _collection_[ track by _id_]' but got '{0}'.",
                expression);
        }

        return {
            itemName: match[2], // (lhs) Left-hand side,
            source: $parse(match[3]),
            trackByExp: match[4],
            modelMapper: $parse(match[1] || match[2])
        };

    };

    self.getGroupNgRepeatExpression = function () {
        return '$group in $select.groups';
    };

    self.getNgRepeatExpression = function (itemName, source, trackByExp, grouped) {
        var expression = itemName + ' in ' + (grouped ? '$group.items' : source);
        if (trackByExp) {
            expression += ' track by ' + trackByExp;
        }
        return expression;
    };
}]);

}());
angular.module("ui.select").run(["$templateCache", function($templateCache) {$templateCache.put("selectize/choices.tpl.html","<div ng-show=\"$select.open\" class=\"ui-select-choices ui-select-dropdown selectize-dropdown single\"><div class=\"ui-select-choices-content selectize-dropdown-content\"><div class=\"ui-select-choices-group optgroup\" role=\"listbox\"><div ng-show=\"$select.isGrouped\" class=\"ui-select-choices-group-label optgroup-header\" ng-bind=\"$group.name\"></div><div role=\"option\" class=\"ui-select-choices-row\" ng-class=\"{active: $select.isActive(this), disabled: $select.isDisabled(this)}\"><div class=\"option ui-select-choices-row-inner\" data-selectable=\"\"></div></div></div></div></div>");
$templateCache.put("selectize/match.tpl.html","<div ng-hide=\"($select.open || $select.isEmpty())\" class=\"ui-select-match\" ng-transclude=\"\"></div>");
$templateCache.put("selectize/select.tpl.html","<div class=\"ui-select-container selectize-control single\" ng-class=\"{\'open\': $select.open}\"><div class=\"selectize-input\" ng-class=\"{\'focus\': $select.open, \'disabled\': $select.disabled, \'selectize-focus\' : $select.focus}\" ng-click=\"$select.activate()\"><div class=\"ui-select-match\"></div><input type=\"text\" autocomplete=\"off\" tabindex=\"-1\" class=\"ui-select-search ui-select-toggle\" ng-click=\"$select.toggle($event)\" placeholder=\"{{$select.placeholder}}\" ng-model=\"$select.search\" ng-hide=\"!$select.searchEnabled || ($select.selected && !$select.open)\" ng-disabled=\"$select.disabled\" aria-label=\"{{ $select.baseTitle }}\"></div><div class=\"ui-select-choices\"></div></div>");}]);