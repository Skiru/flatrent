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
use App\CreateFlat\Domain\Flat\Room\Room;
use App\CreateFlat\Domain\Flat\Room\RoomId;
use App\CreateFlat\Domain\Flat\Room\RoomName;
use App\CreateFlat\Domain\Flat\Room\RoomType;
use App\CreateFlat\Domain\User\UserId;
use App\Shared\Domain\DataStructures\Vector;
use App\Shared\Infrastructure\Dto\FlatDto;
use App\Shared\Infrastructure\Dto\RoomDto;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Messenger\MessageBusInterface;

final class CreateFlatController extends AbstractController
{
    public function __construct(private readonly MessageBusInterface $bus)
    {
    }

    public function __invoke(#[MapRequestPayload] FlatDto $flatDto): JsonResponse
    {
        $roomsSequence = Vector::fromArray($flatDto->rooms)->transform(
            static fn(RoomDto $dto): Room => new Room(
                RoomId::fromString($dto->id),
                new RoomName($dto->name ?? 'no-name'),
                RoomType::
            )
        );

        $rooms = Vector::fromArray($roomsSequence->toArray());

        $command = new CreateFlatCommand(
            FlatId::fromString($flatDto->id),
            UserId::create(),
            new Address(
                new City($flatDto->address->city),
                new Street($flatDto->address->street),
                new ZipCode($flatDto->address->zipCode),
                new Building(
                    new BuildingNumber($flatDto->address->building->number),
                    new DoorNumber($flatDto->address->building->doorNumber ?? 0),
                    new FlatNumber($flatDto->address->building->flatNumber ?? 0),
                ),
            ),
            $rooms,
        );
        dd($command);
        $this->bus->dispatch($command);

        return new JsonResponse(null, Response::HTTP_CREATED);
    }
}
