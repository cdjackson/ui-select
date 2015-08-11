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
