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