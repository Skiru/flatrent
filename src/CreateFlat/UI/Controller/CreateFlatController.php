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
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Serializer\SerializerInterface;

final class CreateFlatController extends AbstractController
{
    public function __construct(
        MessageBusInterface $bus,
        SerializerInterface $serializer,
    ) {
    }

    public function __invoke(
        #[MapRequestPayload] CreateFlatDto $createFlatDto,
    ): JsonResponse {
//        /** @var CreateFlatRequest $dto */
//        $dto = $serializer->deserialize(
//            $request->getContent(),
//            CreateFlatRequest::class,
//            JsonEncoder::FORMAT,
//        );

        dd($createFlatDto);

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
