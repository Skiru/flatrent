<?php

declare(strict_types=1);

namespace App\CreateFlat\UI\Controller;

use App\CreateFlat\Application\CreateFlatCommand;
use App\CreateFlat\Domain\Flat\Address\Address;
use App\CreateFlat\Domain\Flat\Address\Building\Building;
use App\CreateFlat\Domain\Flat\Address\Building\BuildingNumber;
use App\CreateFlat\Domain\Flat\Address\Building\DoorNumber;
use App\CreateFlat\Domain\Flat\Address\Building\FlatNumber;
use App\CreateFlat\Domain\Flat\Address\City;
use App\CreateFlat\Domain\Flat\Address\Street;
use App\CreateFlat\Domain\Flat\Address\ZipCode;
use App\CreateFlat\Domain\Flat\FlatId;
use App\CreateFlat\Domain\User\UserId;
use Ds\Vector;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Messenger\MessageBusInterface;

final class CreateFlatController extends AbstractController
{
    public function __invoke(MessageBusInterface $bus, Request $request): JsonResponse
    {
        $command = new CreateFlatCommand(
            FlatId::create(),
            UserId::create(),
            new Address(
                new City('Rzeszów'),
                new Street('Warszawska'),
                new ZipCode('35-233'),
                new Building(
                    new BuildingNumber(997),
                    new DoorNumber(25),
                    new FlatNumber(6),
                ),
            ),
            new Vector(),
        );

        $bus->dispatch($command);

        return new JsonResponse(null, Response::HTTP_CREATED);
    }
}
