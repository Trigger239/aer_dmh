﻿# AliExpress Russia Delivery Method Helper

![icon](https://raw.githubusercontent.com/Trigger239/aer_dmh/master/assets/images/icon128.png)
AER_DMH - это расширение для браузера Chrome, Firefox и Opera, предназначенное для облегчения поиска наиболее выгодных предложений на AliExpress с учётом способа и стоимости доставки.

## Зачем это нужно?

С некоторых пор у торговой площадки AliExpress появилось российское подразделение AliExpress Russia (AER), в результате чего был полностью переработан сайт в RU-зоне (https://aliexpress.ru). Одним из самых неприятных (на мой взгляд) нововведений стало то, что на странице товара больше не отображается список всех доступных способов доставки с их стоимостью. Вот вся информация, которая видна покупателю:

![delivery_methods_original](https://raw.githubusercontent.com/Trigger239/aer_dmh/master/assets/images/delivery_methods_original.png)

Мало того, что видны только самые дешёвые (в данном случае - бесплатные) способы доставки, так ещё и не понятно, что именно это за способы! А бесплатными часто бывают, например, Aliexpress Saver Shipping или Aliexpress Standard Shipping. При этом между ними огромная разница. Первый не имеет полноценного отслеживания и идёт обычно гораздо дольше второго. 

Иногда хочется получить товар побыстрее, заплатив пару долларов за Standard Shipping, но понять, доступен ли этот вариант у данного продавца, непросто. Нужно пройти целый квест: добавить товар в корзину, открыть корзину, затем начать оформление заказа, и только там будет видна вся информация по доставке. После этого надо оформление заказа отменить (или, как минимум, закрыть страницу). Если при поиске нужного товара приходится перебирать пару десятков вариантов, эта возня быстро надоедает. Раньше можно было перейти на глобальный сайт https://aliexpress.com при помощи "магической" кнопочки `"Go to Global site (English)"` в правом верхнем углу страницы, но теперь эту возможность прикрыли. Вручную заменить в адресной строке `.ru` на `.com` тоже не выходит - происходит перенаправление обратно. Жуйте, как говорится, что дают.

В общем, в тот момент, когда эта ерунда меня окончательно достала, и было создано это расширение. Попутно я реализовал ещё некоторую полезную функциональность.

## Что это даёт?

В настоящий момент расширение обладает следующими функциями:
* Отображение всех доступных способов доставки и их стоимости на странице товара (`https://aliexpress.ru/item*`);
* Отображение той же информации на странице поиска (`https://aliexpress.ru/wholesale*`) в виде всплывающего окна;
* Расчёт и отображение полной стоимости товара и доставки.

## Установка в Chrome[^1]

1. Скачайте архив `aer_dmh.zip` из раздела ["Releases"](https://github.com/Trigger239/aer_dmh/releases).
2. Распакуйте архив куда-нибудь на вашем компьютере.
3. Перейдите на страницу управления расширениями Chrome (`chrome://extensions`).
4. Активируйте "Режим разработчика" в правом верхнем углу.
4. Нажмите кнопку "Загрузить распакованное расширение" в левом верхнем углу.
5. Выберите папку `aer_dmh`, появившуюся после распаковки архива.
6. Расширение готово к работе! (на всякий случай, убедитесь, что оно включено)

[^1]: К сожалению, в свете последних событий я не могу загрузить расширение в Chrome Web Store, поскольку для регистрации аккаунта разработчика нужно заплатить сервисный сбор, а оплатить что-либо от Google в России невозможно. Поэтому установка производится "через одно место".

## Установка в Opera

Установка в браузере Opera абсолютно аналогична установке в Chrome (см. выше).

## Установка в Firefox

Установка производится штатными средствами из каталога дополнений Firefox: https://addons.mozilla.org/ru/firefox/addon/aer_dmh/

## Использование

На страницах товаров (`https://aliexpress.ru/item*`) расширение добавляет таблицу следующего вида:

![delivery_methods_new_item](https://raw.githubusercontent.com/Trigger239/aer_dmh/master/assets/images/delivery_methods_new_item.png)

* Первый столбец - тип доставки (обычная доставка или через пункты выдачи);
* Второй столбец - название службы (способа) доставки;
* Третий столбец - предполагаемая дата доставки;
* Четвёртый столбец - стоимость доставки (или "Free", если она бесплатная);
* Пятый столбец - сумма стоимости товара (с учётом количества) и стоимости доставки.

На странице поиска (`https://aliexpress.ru/wholesale*`) у каждого товара добавляется кнопка:

![wholesale_button](https://raw.githubusercontent.com/Trigger239/aer_dmh/master/assets/images/wholesale_button.png)

При нажатии на неё появляется окно со значком загрузки. Через некоторое время в этом окне отображаются доступные способы доставки (чтобы просмотреть всю доступную информацию, используйте полосы прокрутки):

![delivery_methods_new_wholesale](https://raw.githubusercontent.com/Trigger239/aer_dmh/master/assets/images/delivery_methods_new_wholesale.png)

Формат представления способов доставки такой же, как на странице товара, с тем лишь отличием, что дата доставки не отображается для экономии места. Стоимость доставки, а также суммарная стоимость рассчитывается в предположении, что покупается одна единица товара. Над таблицей указано, из какой страны производится отправка. __Обратите внимание:__ здесь показываются только способы доставки из какой-то одной страны, выбранной по умолчанию! Может быть доступна доставка и из других стран, но об этом можно узнать, только зайдя на страницу товара.

Расширение имеет ряд настроек, доступ к которым можно получить, нажав "Расширения" справа от адресной строки браузера и затем кликнув по расширению "AER Delivery Method Helper":

![open_settings](https://raw.githubusercontent.com/Trigger239/aer_dmh/master/assets/images/open_settings.png)

Альтернативно, можно _закрепить_ расширение, нажав соответствующую кнопку справа от его названия:

![pin_extension](https://raw.githubusercontent.com/Trigger239/aer_dmh/master/assets/images/pin_extension.png)

После этого открыть настройки можно будет, кликнув по иконке расширения.

Окно настроек выглядит следующим образом:

![settings](https://raw.githubusercontent.com/Trigger239/aer_dmh/master/assets/images/settings.png)

* "Show on Item page" - определяет, отображать ли способы доставки на страницах товаров;
* "Show on Search page" - определяет, отображать ли способы доставки на странице поиска;
* "Popup timeout (ms)" - время в миллисекундах, спустя которое окно со способами доставки на странице поиска закроется после того, как курсор мыши выйдет за его пределы (от 100 до 5000 мс);
* "Show total cost (product + delivery)" - определяет, отображать ли суммарную стоимость;
* "Request method" - выбор метода получения информации о доставке. Сейчас доступны два метода:
  - "aliexpress.com" - используется запрос к глобальному API Aliexpress (не к русской версии). Метод надёжный, работает быстро, но позволяет увидеть лишь способы доставки из группы "Доставка" ("Пункты выдачи" не отображаются).
  - "Order page" - метод, основанный на использовании API оформления заказа. Может работать заметно медленнее предыдущего, но отображает способы доставки из всех групп. **Для использования этого метода требуется войти в аккаунт Aliexpress!**
  _При выборе другого метода получения информации все открытые страницы товаров и поиска будут автоматически обновлены._
* "Enable debug logging" - определяет, выводить ли отладочную информацию в консоль (которую можно открыть, нажав F12);
* "Restore defaults" - восстановить настройки по умолчанию.

## Об ошибках и их исправлении

В том случае, если расширение работает некорректно или не работает вовсе, вы можете помочь проекту, сообщив о проблеме, создав [Issue](https://github.com/Trigger239/aer_dmh/issues/new) на GitHub (нужна регистрация).

Очень желательно предоставить как можно более подробную информацию, в том числе, лог ошибок расширения, который можно найти на странице управления расширениями (chrome://extensions) (см. рисунок ниже) и в "Инструментах разработчика" (нажать F12 на той странице, где вы попытались использовать расширение, перейти во вкладку "Console" - ошибки там показаны красным цветом). Идеальным вариантом будет включить "Debug logging" в настройках расширения, затем заново воспроизвести ошибку и предоставить полный лог из консоли.

![errors](https://raw.githubusercontent.com/Trigger239/aer_dmh/master/assets/images/errors.png)
