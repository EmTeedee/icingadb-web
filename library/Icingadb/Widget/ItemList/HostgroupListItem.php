<?php

namespace Icinga\Module\Icingadb\Widget\ItemList;

use Icinga\Chart\Donut;
use Icinga\Module\Icingadb\Common\BaseTableRowItem;
use Icinga\Module\Icingadb\Common\Links;
use Icinga\Module\Icingadb\Widget\HostStateBadges;
use Icinga\Module\Icingadb\Widget\ServiceStateBadges;
use Icinga\Module\Icingadb\Widget\VerticalKeyValue;
use ipl\Html\BaseHtmlElement;
use ipl\Html\Html;
use ipl\Html\HtmlDocument;
use ipl\Html\HtmlString;
use ipl\Web\Widget\Link;

class HostgroupListItem extends BaseTableRowItem
{
    protected function assembleColumns(HtmlDocument $columns)
    {
        $hostsChart = (new Donut())
            ->addSlice($this->item->hosts_up, ['class' => 'slice-state-ok'])
            ->addSlice($this->item->hosts_down_handled, ['class' => 'slice-state-critical-handled'])
            ->addSlice($this->item->hosts_down_unhandled, ['class' => 'slice-state-critical'])
            ->addSlice($this->item->hosts_pending, ['class' => 'slice-state-pending']);

        $servicesChart = (new Donut())
            ->addSlice($this->item->services_ok, ['class' => 'slice-state-ok'])
            ->addSlice($this->item->services_warning_handled, ['class' => 'slice-state-warning-handled'])
            ->addSlice($this->item->services_warning_unhandled, ['class' => 'slice-state-warning'])
            ->addSlice($this->item->services_critical_handled, ['class' => 'slice-state-critical-handled'])
            ->addSlice($this->item->services_critical_unhandled, ['class' => 'slice-state-critical'])
            ->addSlice($this->item->services_unknown_handled, ['class' => 'slice-state-unknown-handled'])
            ->addSlice($this->item->services_unknown_unhandled, ['class' => 'slice-state-unknown'])
            ->addSlice($this->item->services_pending, ['class' => 'slice-state-pending']);

        if ($this->item->hosts_total > 0) {
            $badges = new HostStateBadges($this->item);
            $badges->getUrl()->getParams()->mergeValues(['hostgroup.name' => $this->item->name]);

            $columns->add([
                $this->createColumn(HtmlString::create($hostsChart->render())),
                $this->createColumn($badges->createLink(new VerticalKeyValue(
                    'Host' . ($this->item->hosts_total > 1 ? 's' : ''),
                    $this->item->hosts_total
                )))->addAttributes(['class' => 'hosts-total text-center']),
                $this->createColumn($badges)
            ]);
        }

        if ($this->item->services_total > 0) {
            $badges = new ServiceStateBadges($this->item);
            $badges->getUrl()->getParams()->mergeValues(['hostgroup.name' => $this->item->name]);

            $columns->add([
                $this->createColumn(HtmlString::create($servicesChart->render())),
                $this->createColumn($badges->createLink(new VerticalKeyValue(
                    'Service' . ($this->item->services_total > 1 ? 's' : ''),
                    $this->item->services_total
                )))->addAttributes(['class' => 'services-total text-center']),
                $this->createColumn($badges)
            ]);
        }
    }

    protected function assembleTitle(BaseHtmlElement $title)
    {
        $title->add([
            new Link($this->item->display_name, Links::hostgroup($this->item)),
            Html::tag('br'),
            $this->item->name
        ]);
    }
}
