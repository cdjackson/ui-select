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

            // Remove item from multiple select
            ctrl.removeChoice = function (index) {
                var removedChoice = $select.selected[index];

                // if the choice is locked, can't remove it
                if (removedChoice._uiSelectChoiceLocked) {
                    return;
                }

                var locals = {};
                locals[$select.parserResult.itemName] = removedChoice;

                $select.selected.splice(index, 1);
                ctrl.activeMatchIndex = -1;
                $select.sizeSearchInput();

                var callbackContext = {
                    $item: removedChoice,
                    $model: $select.parserResult.modelMapper($scope, locals)
                };

                // Give some time for scope propagation.
                function completeRemoval() {
                    $timeout(function () {
                        $select.onRemoveCallback($scope, callbackContext);
                    });

                    ctrl.updateModel();
                }

                // Call the onBeforeRemove callback
                // Allowable responses are -:
                // falsy: Abort the removal
                // promise: Wait for response
                // true: Complete removal
                var onBeforeRemoveResult = ctrl.onBeforeRemoveCallback($scope, callbackContext);
                if (angular.isDefined(onBeforeRemoveResult)) {
                    if (angular.isFunction(onBeforeRemoveResult.then)) {
                        // Promise returned - wait for it to complete before completing the selection
                        onBeforeRemoveResult.then(function (result) {
                            if (!result) {
                                return;
                            }
                            completeRemoval(result);
                        });
                    } else if (onBeforeRemoveResult === true) {
                        completeRemoval();
                    }
                } else {
                    completeRemoval();
                }
            };

            ctrl.getPlaceholder = function () {
                //Refactor single?
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
                    if (KEY.isHorizontalMovement(key)) {
                        processed = _handleMatchSelection(key);
                    }
                    if (processed && key != KEY.TAB) {
                        //TODO Check si el tab selecciona aun correctamente
                        //Crear test
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

                if (caretPosition > 0 || ($select.search.length && key == KEY.RIGHT)) {
                    return false;
                }

                $select.close();

                function getNewActiveMatchIndex() {
                    switch (key) {
                        case KEY.LEFT:
                            // Select previous/first item
                            if (~$selectMultiple.activeMatchIndex) {
                                return prev;
                            }
                            // Select last item
                            else {
                                return last;
                            }
                            break;
                        case KEY.RIGHT:
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
                        case KEY.BACKSPACE:
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
                        case KEY.DELETE:
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
