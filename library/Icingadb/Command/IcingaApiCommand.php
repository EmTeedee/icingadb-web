<?php

/* Icinga DB Web | (c) 2021 Icinga GmbH | GPLv2 */

namespace Icinga\Module\Icingadb\Command;

class IcingaApiCommand
{
    /**
     * Command data
     *
     * @var array
     */
    protected $data;

    /**
     * Name of the endpoint
     *
     * @var string
     */
    protected $endpoint;

    /**
     * Create a new Icinga 2 API command
     *
     * @param   string  $endpoint
     * @param   array   $data
     *
     * @return  static
     */
    public static function create($endpoint, array $data)
    {
        return (new static())
            ->setEndpoint($endpoint)
            ->setData($data);
    }

    /**
     * Get the command data
     *
     * @return array
     */
    public function getData()
    {
        return $this->data;
    }

    /**
     * Set the command data
     *
     * @param   array   $data
     *
     * @return  $this
     */
    public function setData($data)
    {
        $this->data = $data;

        return $this;
    }

    /**
     * Get the name of the endpoint
     *
     * @return string
     */
    public function getEndpoint()
    {
        return $this->endpoint;
    }

    /**
     * Set the name of the endpoint
     *
     * @param   string  $endpoint
     *
     * @return  $this
     */
    public function setEndpoint($endpoint)
    {
        $this->endpoint = $endpoint;

        return $this;
    }
}
